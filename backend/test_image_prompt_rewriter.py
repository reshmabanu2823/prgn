"""
Test suite for LLM-based image prompt rewriting and template fallback.
"""
import unittest
from unittest.mock import MagicMock, patch
import app


class TestImagePromptRewriter(unittest.TestCase):

    def setUp(self):
        self.original_llm = getattr(app, 'llm', None)

    def tearDown(self):
        if self.original_llm:
            app.llm = self.original_llm

    def test_clean_rewritten_image_prompt(self):
        """Test prompt cleaning from LLM outputs."""
        self.assertEqual(
            app._clean_rewritten_image_prompt('  "A cinematic cat in golden hour"  '),
            'A cinematic cat in golden hour'
        )
        self.assertEqual(
            app._clean_rewritten_image_prompt('Here is the rewritten prompt: A vivid landscape with mountains'),
            'A vivid landscape with mountains'
        )
        self.assertEqual(
            app._clean_rewritten_image_prompt('Prompt: An isometric futuristic cybernetic city block'),
            'An isometric futuristic cybernetic city block'
        )
        self.assertEqual(app._clean_rewritten_image_prompt(''), '')

    def test_vague_prompt_rewriting_success(self):
        """Test that short/vague prompts are rewritten with rich style and detail."""
        mock_llm = MagicMock()
        mock_llm.rewrite_image_prompt.return_value = (
            "A majestic domestic shorthair cat with amber eyes sitting on a velvet cushion, "
            "dramatic side lighting, warm tones, high contrast, cinematic movie still."
        )
        app.llm = mock_llm

        enhanced = app._build_image_generation_prompt('a cat', 'cinematic', 'hd')
        
        mock_llm.rewrite_image_prompt.assert_called_once()
        self.assertIn("majestic domestic shorthair cat", enhanced)
        self.assertIn("cinematic movie still", enhanced)
        # Should not be the old static template suffix
        self.assertNotIn("Render style guidance:", enhanced)

    def test_detailed_prompt_preserves_intent(self):
        """Test that already detailed prompts are preserved and enhanced without loss of intent."""
        mock_llm = MagicMock()
        mock_llm.rewrite_image_prompt.return_value = (
            "A neon-lit Tokyo ramen bar nestled in a rainy alley, steam rising from ceramic bowls, "
            "vibrant reflections on wet pavement, photorealistic textures, 8k resolution, crisp studio lighting."
        )
        app.llm = mock_llm

        detailed_input = "A neon-lit Tokyo ramen bar in a rainy alley with steam and wet pavement reflections"
        enhanced = app._build_image_generation_prompt(detailed_input, 'photo', 'standard')

        self.assertIn("Tokyo ramen bar", enhanced)
        self.assertIn("photorealistic", enhanced)

    def test_fallback_on_llm_exception(self):
        """Test that if the LLM raises an error or times out, it gracefully falls back to the template."""
        mock_llm = MagicMock()
        mock_llm.rewrite_image_prompt.side_effect = RuntimeError("Ollama connection refused / Timeout")
        app.llm = mock_llm

        fallback_result = app._build_image_generation_prompt('a red sports car', 'product', 'hd')

        # Fallback template contains the style guidance and quality target
        self.assertIn("a red sports car.", fallback_result)
        self.assertIn("product-shot framing, studio lighting, premium commercial look", fallback_result)
        self.assertIn("Quality target: ultra detailed", fallback_result)
        self.assertIn("Requirements:", fallback_result)

    def test_fallback_on_empty_or_too_short_rewrite(self):
        """Test fallback when LLM returns an empty or invalid response."""
        mock_llm = MagicMock()
        mock_llm.rewrite_image_prompt.return_value = "cat"  # too short (<10 chars)
        app.llm = mock_llm

        fallback_result = app._build_image_generation_prompt('a cat', 'illustration', 'standard')

        self.assertIn("a cat.", fallback_result)
        self.assertIn("clean illustration style", fallback_result)
        self.assertIn("Quality target: high quality", fallback_result)

    def test_style_mappings(self):
        """Verify all supported styles produce correct fallback hints."""
        for style in ['photo', 'cinematic', 'illustration', 'concept_art', 'product']:
            mock_llm = MagicMock()
            mock_llm.rewrite_image_prompt.side_effect = Exception("offline")
            app.llm = mock_llm
            res = app._build_image_generation_prompt('test prompt', style, 'hd')
            self.assertIn('test prompt.', res)
            self.assertIn('Render style guidance:', res)


if __name__ == '__main__':
    unittest.main()
