import pathlib

content = """<header class="app-header">
  <div class="app-header-title">{{ _('page_title') }}</div>
  <div class="app-header-right">
    <form
      class="language-selector-form"
      method="post"
      action="/api/set-language"
    >
      <label for="language-select" class="visually-hidden"
        >{{ _('language_selector_label') }}</label
      >
      <select
        id="language-select"
        name="locale"
        class="language-selector"
        aria-label="{{ _('language_selector_label') }}"
        onchange="this.form.submit()"
      >
        {% for locale in supported_locales %}
        <option value="{{ locale }}" {% if locale == current_locale %}selected{% endif %}>
          {{ locale_labels.get(locale, locale) }}
        </option>
        {% endfor %}
      </select>
    </form>
  </div>
</header>

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
</style>
"""

file_path = pathlib.Path("src/templates/components/header.html")
file_path.write_text(content, encoding='utf-8')
print(f"File written successfully to {file_path}")
print(f"Content length: {len(content)} characters")
