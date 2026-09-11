"""LLM Orchestrator for Pragna (multilayer routing architecture).

This service now uses a simple SQLite-backed memory database (services.memory_db)
to persist conversation history per user across server restarts.

Also includes advanced caching to reduce redundant LLM calls and improve performance.
"""
import logging
import json
from typing import Optional, List

import config
from services.classifier import classify_query
from services.router import route_query
from services.planner import create_plan
from services.prompt_builder import build_prompt
from services.llm import generate_completion
from services import memory_db
from services import style_profile
from services import tone_detector
from services.cache_service import get_cache_service
from services.rag_service import get_rag_service

logger = logging.getLogger(__name__)


# Chat mode instructions
CHAT_MODES = {
    "general": "You are a helpful, friendly AI assistant.",
    "explain_concepts": "You are an educator specializing in clear, thorough explanations. Break down complex concepts into digestible parts. Use examples and analogies when helpful.",
    "generate_ideas": "You are a creative brainstorming partner. Generate innovative, diverse, and practical ideas. Encourage out-of-the-box thinking while remaining realistic.",
    "write_content": "You are a professional content writer. Create engaging, well-structured, and polished content. Consider tone, audience, and format carefully.",
    "code_assistance": "You are an expert programmer and code reviewer. Provide clean, efficient, well-commented code. Explain implementation details and best practices.",
    "ask_questions": "You are a thoughtful conversationalist who asks probing questions to deepen understanding. Help the user explore their thoughts and ideas.",
    "creative_writing": "You are a creative storyteller and writer. Craft vivid narratives, interesting characters, and engaging dialogue. Be imaginative and expressive.",
}

class LLMService:
    """LLM Service using Groq API"""
    
    def __init__(self):
        self.api_key = config.GROQ_API_KEY
        self.model = config.GROQ_MODEL
        # Max history messages per user (used by memory_db to prune)
        self.max_history = config.CONVERSATION_HISTORY_SIZE
        # Cache configuration
        self.cache = get_cache_service()
        self.llm_cache_ttl = 600  # 10 minutes for LLM responses
        # RAG service for context retrieval - only instantiate (loads
        # sentence-transformers/torch/faiss into memory) when actually
        # enabled; RAG_ENABLED=False keeps this at zero cost.
        self.rag = get_rag_service() if config.RAG_ENABLED else None
        self.use_rag = False  # Will be enabled after RAG initialization
        # Chat mode
        self.current_mode = "general"
        
        # In ollama_only or deepseek_local mode, Groq API key is not required
        if config.LLM_PROVIDER == 'ollama_only':
            logger.info(f"✅ LLM Service initialized in OLLAMA-ONLY MODE")
            logger.info(f"   Ollama Model: {config.OLLAMA_MODEL}")
            logger.info(f"   Ollama URL: {config.OLLAMA_API_URL}")
        elif config.LLM_PROVIDER == 'deepseek_local':
            logger.info("✅ LLM Service initialized in DEEPSEEK-LOCAL MODE")
            logger.info(f"   Model : {config.DEEPSEEK_MODEL_NAME}")
            logger.info(f"   Device: auto-detect (CPU → GPU when available)")
        elif not self.api_key:
            logger.warning("⚠️ GROQ_API_KEY not set - LLM service will not work")
        else:
            logger.info(f"✅ LLM Service initialized with model: {self.model}")
    
    def enable_rag(self):
        """Enable RAG for the service."""
        if self.rag and self.rag.enabled and self.rag.index is not None:
            self.use_rag = True
            logger.info("🚀 RAG enabled for LLM Service")
        else:
            logger.warning("⚠️ RAG not available; proceeding without retrieval augmentation")
    
    def _should_use_rag(self, intent: str, message: str) -> bool:
        """
        Determine if RAG should be used for this query.
        
        Use RAG for:
        - General queries (knowledge-based)
        - Realtime queries (factual information)
        - Not for tool/calculator queries
        
        Args:
            intent: Query intent (general, realtime, news, tool)
            message: User message
            
        Returns:
            True if RAG should be used
        """
        if not self.use_rag:
            return False
        
        # Skip RAG for tool/calculator queries
        if intent == "tool":
            return False
        
        # Skip RAG for very short queries (greetings, etc.)
        if len(message.strip()) < 15:
            return False
        
        # Use RAG for general and realtime queries
        return intent in ["general", "realtime"]
    
    def _is_cacheable_query(self, message: str, history: list) -> bool:
        """
        Determine if a query should be cached.
        
        Cacheable queries:
        - No conversation history (pure standalone questions)
        - Short queries (simple questions, not complex conversations)
        - Not personal/user-specific
        
        Args:
            message: User message
            history: Conversation history
            
        Returns:
            True if query is cacheable
        """
        # Don't cache if there's conversation history
        if history and len(history) > 0:
            return False
        
        # Don't cache very long queries (likely multi-turn context)
        if len(message) > 500:
            return False
        
        # Don't cache queries with user-specific indicators
        personal_indicators = ['my ', 'i have', 'my name', 'my email', 'my phone', 
                             'i am', 'i live', 'i work', 'my account', 'my profile',
                             'me,', 'mine', 'myself']
        msg_lower = message.lower()
        if any(indicator in msg_lower for indicator in personal_indicators):
            return False
        
        return True
    
    def _get_history(self, user_id: str) -> list:
        """
        Get conversation history for a user with smart pruning.
        
        Uses intelligent pruning to:
        - Stay within token limits (config.MAX_HISTORY_TOKENS)
        - Keep important messages based on recency, role, and content quality
        - Maintain minimum recent context (config.MIN_HISTORY_MESSAGES)
        
        Returns:
            Pruned list of messages
        """
        return memory_db.get_history(
            user_id, 
            max_messages=self.max_history,
            use_smart_pruning=True
        )
    
    def _add_to_history(self, user_id: str, role: str, content: str):
        """
        Add message to history with smart cleanup.
        
        Automatically prunes old messages when history exceeds limits
        while maintaining context quality through intelligent scoring.
        """
        success, stats = memory_db.add_message(
            user_id, 
            role, 
            content, 
            max_messages=self.max_history
        )
        
        if stats.get('reason') == 'token_budget_exceeded':
            logger.info(
                f"🧠 Memory optimized: {stats['pruned_messages']} messages removed | "
                f"Kept {stats['kept_messages']} important messages | "
                f"Tokens: {stats['final_tokens_estimate']}/{stats['token_budget']}"
            )
    
    def clear_history(self, user_id: str):
        """Clear conversation history for a user in the memory database."""
        memory_db.clear_history(user_id)
        logger.info(f"Cleared history for user: {user_id}")
    
    def get_response(
        self,
        message: str,
        language: str = 'en',
        user_id: str = 'default',
        chat_mode: str = 'general',
        model_override: Optional[str] = None,
        fallback_models: Optional[List[str]] = None,
        persona_system_prompt: Optional[str] = None,
        extended_thinking: bool = False,
    ) -> tuple:
        """
        Get AI response for a user message
        
        Args:
            message: User's message
            language: Language code (en, hi, kn, etc.)
            user_id: User identifier for conversation history
            chat_mode: Chat mode (general, explain_concepts, code_assistance, etc.)
            extended_thinking: Enable deeper step-by-step reasoning
            
        Returns:
            Tuple of (AI response string, list of search sources, optional thinking content)
        """
        # If no key is set and in development mode, proceed through full pipeline with fallback

        try:
            intent_result = classify_query(message, model_override=model_override)
            intent = intent_result.get('intent', 'general')
            route = route_query(intent)
            confidence = float(intent_result.get('confidence', 0.0))
            logger.info(
                "Intent classified as %s (confidence %.2f) routed to %s",
                intent,
                confidence,
                route.get('target')
            )

            plan = create_plan(message, route)

            if plan.get('mode') == 'tool':
                ai_response = plan.get('tool_result', 'I handled your calculation.')
                self._add_to_history(user_id, "user", message)
                self._add_to_history(user_id, "assistant", ai_response)
                return ai_response, [], None

            context_text = plan.get('context')
            sources = plan.get('sources', [])

            # ==================== RAG RETRIEVAL LOGIC ====================
            # If plan didn't provide context and RAG is available, try RAG
            if context_text is None and self._should_use_rag(intent, message):
                logger.debug(f"🔍 Attempting RAG retrieval for: {message[:50]}...")
                rag_result = self.rag.retrieve_context(message, top_k=3)
                
                if rag_result.get('found'):
                    context_text = rag_result.get('context')
                    rag_sources = rag_result.get('sources', [])
                    
                    # Convert RAG sources to compatible format
                    if rag_sources:
                        sources.extend([
                            {
                                'title': f"Knowledge Base - Chunk {i+1}",
                                'snippet': src.get('text', '')[:200],
                                'source': src.get('document_id', 'rag_index')
                            }
                            for i, src in enumerate(rag_sources)
                        ])
                        logger.info(f"📚 RAG provided context from {len(rag_sources)} sources")
            # =========================================================

            # If live/realtime context is still unavailable, provide a clean professional notification.
            if intent in {"realtime", "news"} and not context_text:
                unavailable_msg = (
                    "I could not fetch verified live web data for this topic right now. "
                    "Please check your internet connection or try rephrasing your question."
                )
                self._add_to_history(user_id, "user", message)
                self._add_to_history(user_id, "assistant", unavailable_msg)
                return unavailable_msg, [], None

            history = self._get_history(user_id)
            user_profile_memory = memory_db.get_user_profile_summary(user_id)
            
            # ==================== CACHING LOGIC ====================
            # Check if we should cache this query
            # Skip caching entirely when a persona or extended thinking is active
            is_cacheable = self._is_cacheable_query(message, history) and not persona_system_prompt and not extended_thinking
            cache_key = None
            
            if is_cacheable:
                cache_key = self.cache.generate_cache_key(
                    message, 
                    language, 
                    cache_type="llm"
                )
                
                # Try to get from cache
                cached_response = self.cache.get_cache(cache_key)
                if cached_response is not None:
                    logger.info(f"🔥 LLM Cache HIT for: {message[:50]}...")
                    self._add_to_history(user_id, "user", message)
                    self._add_to_history(user_id, "assistant", cached_response)
                    return cached_response, sources, None
            # =====================================================
            
            prompt_messages = build_prompt(
                message,
                history,
                language,
                context_text,
                chat_mode,
                user_profile_memory=user_profile_memory,
                extended_thinking=extended_thinking,
            )
            
            if persona_system_prompt:
                # An active custom persona replaces the auto-inferred style message entirely,
                # rather than stacking both and risking conflicting instructions.
                system_msg = persona_system_prompt
            else:
                # Derive user style profile from history and prepend style adaptation directive
                style = style_profile.get_style_profile(user_id, max_messages=self.max_history)

                # Detect tone from CURRENT message and override profile tone if detected
                current_tone = tone_detector.detect_tone(message)
                if current_tone != "neutral":
                    style["tone"] = current_tone
                    logger.info(f"Detected message tone: {current_tone}. Overriding profile tone.")

                # Pass language and chat_mode to style_system_message so it includes both style AND mode prefix
                system_msg = style_profile.style_system_message(style, language, chat_mode)

            prompt_messages.insert(0, {"role": "system", "content": system_msg})
            
            logger.info("Calling generate_completion: model_override=%s, fallback_models=%s, extended_thinking=%s", model_override, fallback_models, extended_thinking)
            
            raw_ai_response = generate_completion(
                prompt_messages,
                model_override=model_override,
                fallback_models=fallback_models,
                language=language,
                chat_mode=chat_mode,
                extended_thinking=extended_thinking,
            )
            
            from services.prompt_builder import extract_thinking_from_response
            cleaned_ai_response, thinking = extract_thinking_from_response(raw_ai_response)
            ai_response = cleaned_ai_response if cleaned_ai_response else raw_ai_response

            logger.info("AI response received: %s... (thinking=%s)", ai_response[:100], bool(thinking))

            # Store in cache if cacheable
            if is_cacheable and cache_key:
                self.cache.set_cache(cache_key, ai_response, self.llm_cache_ttl)
                logger.info(f"💾 LLM response cached (ttl: {self.llm_cache_ttl}s)")

            self._add_to_history(user_id, "user", message)
            self._add_to_history(user_id, "assistant", ai_response)

            return ai_response, sources, thinking

        except Exception as exc:
            logger.error(f"Unexpected error in get_response: {exc}", exc_info=True)
            return "Sorry, something went wrong. Please try again.", [], None

    def get_response_stream(
        self,
        message: str,
        language: str = 'en',
        user_id: str = 'default',
        chat_mode: str = 'general',
        model_override: Optional[str] = None,
        fallback_models: Optional[List[str]] = None,
        persona_system_prompt: Optional[str] = None,
        extended_thinking: bool = False,
    ):
        """
        Get streaming AI response for a user message
        Yields chunks of text
        """
        # Stream response chunks from get_response

        try:
            response_text, sources, thinking = self.get_response(
                message,
                language,
                user_id,
                chat_mode,
                model_override=model_override,
                fallback_models=fallback_models,
                persona_system_prompt=persona_system_prompt,
                extended_thinking=extended_thinking,
            )
            if thinking:
                yield json.dumps({"thinking": thinking}) + "\n"
            if sources:
                yield json.dumps({"sources": sources}) + "\n"

            for chunk in self._chunk_response(response_text):
                yield json.dumps({"content": chunk}) + "\n"

        except Exception as exc:
            logger.error(f"Error in get_response_stream: {exc}", exc_info=True)
            yield json.dumps({"error": str(exc)}) + "\n"

    @staticmethod
    def _chunk_response(text: str, size: int = 200) -> list:
        if not text:
            return []
        return [text[i:i + size] for i in range(0, len(text), size)]

    def rewrite_image_prompt(
        self,
        user_prompt: str,
        style_hint: str,
        detail_hint: str = "high quality",
    ) -> str:
        """
        Rewrite a user's prompt into a vivid, detailed image-generation prompt.
        Uses a lightweight/fast LLM completion for minimal latency (<1-2s).
        """
        prompt_clean = user_prompt.strip()
        system_instruction = (
            "You are an expert AI image prompt engineer. "
            "Your task is to rewrite the user's input into a detailed, vivid prompt for an image generation model. "
            "Keep the core subject, concept, and intent exactly as given. "
            "Add specific visual details: lighting, composition, mood, texture, color palette, and perspective. "
            f"Incorporate the required visual style: {style_hint}. "
            f"Target quality: {detail_hint}. "
            "Do NOT add any conversational filler, preamble, explanation, or quotes. "
            "Output ONLY the final rewritten image generation prompt."
        )
        user_message = f"Original prompt: {prompt_clean}"

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_message},
        ]

        model_override = getattr(config, 'MODEL_PROFILE_LIGHT_KEY', None)
        fallbacks = getattr(config, 'MODEL_PROFILE_LIGHT_FALLBACKS', None)
        response = generate_completion(
            messages,
            model_override=model_override,
            fallback_models=fallbacks,
            chat_mode="creative_writing",
        )
        response_clean = (response or "").strip()
        if not response_clean or any(
            err_marker in response_clean
            for err_marker in [
                "OLLAMA ERROR",
                "OLLAMA FAILED",
                "API KEY NOT CONFIGURED",
                "401 UNAUTHORIZED",
                "Sorry, the AI service",
                "inference failed",
            ]
        ):
            raise RuntimeError(f"LLM rewrite returned error response: {response_clean[:100]}")
        return response_clean


    @staticmethod
    def _can_run_without_groq(model_override: Optional[str]) -> bool:
        """Allow local-only operation when Ollama or DeepSeek local is selected."""
        # DeepSeek local mode never needs a Groq key
        if config.LLM_PROVIDER == 'deepseek_local':
            return True
        if config.LLM_PROVIDER == 'ollama_only' and config.OLLAMA_ENABLED:
            return True
        if config.DEFAULT_MODEL_KEY.strip().lower().startswith("ollama:") and config.OLLAMA_ENABLED:
            return True
        if not model_override:
            return False
        return model_override.strip().lower().startswith("ollama:") and config.OLLAMA_ENABLED

