from services.prompt_builder import extract_artifact_from_response

def test_standalone_html_artifact():
    raw_response = (
        "Built your Coffee Shop Landing Page - check out the preview panel!\n\n"
        "```artifact:html title=\"Coffee Shop Landing Page\"\n"
        "<!DOCTYPE html>\n"
        "<html>\n"
        "<head><title>Espresso Haven</title></head>\n"
        "<body><h1>Welcome to Espresso Haven</h1></body>\n"
        "</html>\n"
        "```"
    )

    cleaned_text, artifact = extract_artifact_from_response(raw_response)
    print("--- Test 1: Standalone HTML Artifact ---")
    print("Cleaned text:", cleaned_text)
    print("Artifact data:", artifact)

    assert artifact is not None
    assert artifact["type"] == "artifact"
    assert artifact["artifact_type"] == "html"
    assert artifact["title"] == "Coffee Shop Landing Page"
    assert "Espresso Haven" in artifact["content"]
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
