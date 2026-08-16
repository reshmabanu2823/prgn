from services.prompt_builder import extract_artifact_from_response

def test_standalone_html_artifact():
    raw_response = (
        "```artifact:html title=\"CatNip | Modern Feline Experience\"\n"
        "<!DOCTYPE html>\n"
        "<html lang=\"en\">\n"
        "<head>\n"
        "  <meta charset=\"UTF-8\">\n"
        "  <title>CatNip | Pure Feline Joy</title>\n"
        "</head>\n"
        "<body>\n"
        "  <h1>CatNip</h1>\n"
        "</body>\n"
        "</html>\n"
        "```"
    )
    cleaned_text, artifact = extract_artifact_from_response(raw_response)
    print("--- Test 1: User Screenshot HTML Artifact ---")
    print("Cleaned text:", cleaned_text.replace("🚀", ""))
    print("Artifact title:", artifact.get("title") if artifact else None)
    print("Artifact content len:", len(artifact.get("content", "")) if artifact else 0)


    assert artifact is not None
    assert artifact["type"] == "artifact"
    assert artifact["artifact_type"] == "html"
    assert "CatNip" in artifact["title"]
    assert "<!DOCTYPE html>" in artifact["content"]
    assert "```artifact:html" not in cleaned_text
    print("Test 1 PASSED!\n")



def test_standard_inline_html_snippet():
    raw_response = (
        "Here is how you write a simple button in HTML:\n\n"
        "```html\n"
        "<button class=\"btn\">Click Me</button>\n"
        "```\n\n"
        "Use CSS to style it as needed."
    )
    cleaned_text, artifact = extract_artifact_from_response(raw_response)
    print("--- Test 2: Standard Inline HTML Snippet ---")
    print("Cleaned text:", cleaned_text)
    print("Artifact data:", artifact)

    assert artifact is None
    assert cleaned_text == raw_response
    print("Test 2 PASSED!\n")


if __name__ == "__main__":
    test_standalone_html_artifact()
    test_standard_inline_html_snippet()
    print("ALL ARTIFACT TESTS PASSED OK!")
