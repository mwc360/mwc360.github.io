document.addEventListener('DOMContentLoaded', function () {
  const codeBlocks = document.querySelectorAll(
    'div.highlighter-rouge:not(.language-mermaid), figure.highlight'
  );
  const languageNames = {
    bash: 'Bash',
    csharp: 'C#',
    html: 'HTML',
    javascript: 'JavaScript',
    js: 'JavaScript',
    json: 'JSON',
    plaintext: 'Text',
    powershell: 'PowerShell',
    python: 'Python',
    ruby: 'Ruby',
    scala: 'Scala',
    shell: 'Shell',
    sql: 'SQL',
    text: 'Text',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML'
  };
  const copyIcon = '<svg aria-hidden="true" viewBox="0 0 16 16"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>';
  const copiedIcon = '<svg aria-hidden="true" viewBox="0 0 16 16"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>';

  codeBlocks.forEach(function (codeBlock) {
    const code = codeBlock.querySelector('.rouge-code pre')
      || codeBlock.querySelector('pre code')
      || codeBlock.querySelector('pre');
    if (!code) {
      return;
    }

    const codeElement = codeBlock.querySelector('code');
    const classes = [
      ...codeBlock.classList,
      ...(codeElement ? codeElement.classList : [])
    ];
    const languageClass = classes.find(function (className) {
      return className.startsWith('language-');
    });
    const language = languageClass
      ? languageClass.replace('language-', '')
      : 'text';

    const toolbar = document.createElement('div');
    toolbar.className = 'code-block-toolbar';

    const languageLabel = document.createElement('span');
    languageLabel.className = 'code-block-language';
    languageLabel.textContent = languageNames[language] || language.toUpperCase();

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy-button';
    button.innerHTML = copyIcon;
    button.setAttribute('aria-label', 'Copy ' + languageLabel.textContent + ' code to clipboard');

    button.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.innerHTML = copiedIcon;
        button.setAttribute('aria-label', 'Code copied to clipboard');
        button.dataset.copied = 'true';

        window.setTimeout(function () {
          button.innerHTML = copyIcon;
          button.setAttribute('aria-label', 'Copy ' + languageLabel.textContent + ' code to clipboard');
          delete button.dataset.copied;
        }, 2000);
      } catch (error) {
        button.setAttribute('aria-label', 'Copy failed');
        window.setTimeout(function () {
          button.setAttribute('aria-label', 'Copy ' + languageLabel.textContent + ' code to clipboard');
        }, 2000);
      }
    });

    toolbar.append(languageLabel, button);
    codeBlock.prepend(toolbar);
  });

  const inlineTokenPatterns = {
    sql: /(--.*$|'(?:''|[^'])*'|"(?:[^"]|"")*"|\b(?:ALTER|AS|BY|CASE|CREATE|DELETE|DESC|DESCRIBE|DISTINCT|DROP|ELSE|END|FROM|FULL|GROUP|HAVING|INNER|INSERT|INTO|JOIN|LEFT|LIMIT|MERGE|NOT|NULL|ON|OPTIMIZE|OR|ORDER|OUTER|REPLACE|RIGHT|SELECT|SET|SHOW|TABLE|THEN|UNION|UPDATE|VACUUM|VALUES|VIEW|WHEN|WHERE|WITH)\b|\b\d+(?:\.\d+)?\b)/gi,
    python: /(#[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\b|\b\d+(?:\.\d+)?\b)/g
  };

  function detectInlineLanguage(text) {
    if (/\b(?:SELECT\b.+\bFROM|INSERT\s+INTO|UPDATE\b.+\bSET|DELETE\s+FROM|CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)|ALTER\s+(?:TABLE|VIEW)|DROP\s+(?:TABLE|VIEW)|MERGE\s+INTO|GROUP\s+BY|ORDER\s+BY|OPTIMIZE\s+\S+|VACUUM\s+\S+|SHOW\s+(?:TABLES|SCHEMAS|TBLPROPERTIES)|DESCRIBE\s+(?:TABLE|DETAIL|HISTORY))\b/i.test(text)
      || /^(?:SELECT|FROM|WHERE|JOIN|UNION|MERGE|OPTIMIZE|VACUUM)$/i.test(text) && text === text.toUpperCase()) {
      return 'sql';
    }

    if (/\b(?:def|class|lambda|import|return|yield|for\s+\w+\s+in|if\b.+:)\b/.test(text)
      || /^[a-z_]\w*(?:\.[A-Za-z_]\w*|\([^)]*\))+$/.test(text)) {
      return 'python';
    }

    return null;
  }

  function highlightInlineCode(code, language) {
    const text = code.textContent;
    const pattern = inlineTokenPatterns[language];
    let lastIndex = 0;
    let match;

    code.textContent = '';
    code.dataset.language = language;
    code.title = language === 'sql' ? 'SQL' : 'Python';

    while ((match = pattern.exec(text)) !== null) {
      code.append(document.createTextNode(text.slice(lastIndex, match.index)));

      const token = document.createElement('span');
      const value = match[0];
      let tokenType = 'keyword';

      if (/^--|^#/.test(value)) {
        tokenType = 'comment';
      } else if (/^['"]/.test(value)) {
        tokenType = 'string';
      } else if (/^\d/.test(value)) {
        tokenType = 'number';
      }

      token.className = 'inline-code-' + tokenType;
      token.textContent = value;
      code.append(token);
      lastIndex = pattern.lastIndex;
    }

    code.append(document.createTextNode(text.slice(lastIndex)));
  }

  document.querySelectorAll('.post-content code.highlighter-rouge').forEach(function (code) {
    const language = detectInlineLanguage(code.textContent.trim());
    if (language) {
      highlightInlineCode(code, language);
    }
  });

  document.querySelectorAll('.post-content table:not(.rouge-table):not(.dataframe)').forEach(function (table) {
    const wrapper = document.createElement('div');
    wrapper.className = 'markdown-table-wrapper';
    table.classList.add('markdown-table');
    table.before(wrapper);
    wrapper.append(table);
  });
});
