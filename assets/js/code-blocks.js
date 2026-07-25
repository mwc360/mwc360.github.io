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
    if (table.parentElement.classList.contains('markdown-table-wrapper')) {
      return;
    }

    const container = document.createElement('div');
    const wrapper = document.createElement('div');
    const toolbar = document.createElement('div');
    const expandButton = document.createElement('button');
    container.className = 'markdown-table-container';
    wrapper.className = 'markdown-table-wrapper';
    toolbar.className = 'markdown-table-toolbar';
    expandButton.type = 'button';
    expandButton.className = 'markdown-table-expand';
    expandButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3.75 1a.75.75 0 0 1 0 1.5H2.5v1.25a.75.75 0 0 1-1.5 0v-2A.75.75 0 0 1 1.75 1Zm8.5 0h2a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0V2.5h-1.25a.75.75 0 0 1 0-1.5ZM1 12.25a.75.75 0 0 1 1.5 0v1.25h1.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1-.75-.75Zm13.25-.75a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.75.75h-2a.75.75 0 0 1 0-1.5h1.25v-1.25a.75.75 0 0 1 .75-.75Z"></path></svg>';
    expandButton.setAttribute('aria-label', 'Expand table');
    expandButton.title = 'Expand table';
    table.classList.add('markdown-table');
    table.before(container);
    toolbar.append(expandButton);
    wrapper.append(table);
    container.append(toolbar, wrapper);

    expandButton.addEventListener('click', function () {
      const dialog = document.createElement('dialog');
      const panel = document.createElement('div');
      const dialogHeader = document.createElement('div');
      const title = document.createElement('strong');
      const closeButton = document.createElement('button');
      const content = document.createElement('div');
      const expandedTable = table.cloneNode(true);

      dialog.className = 'markdown-table-dialog';
      panel.className = 'markdown-table-dialog-panel';
      dialogHeader.className = 'markdown-table-dialog-header';
      title.textContent = 'Expanded table';
      closeButton.type = 'button';
      closeButton.className = 'markdown-table-dialog-close';
      closeButton.textContent = 'Close';
      content.className = 'markdown-table-dialog-content';

      dialogHeader.append(title, closeButton);
      content.append(expandedTable);
      panel.append(dialogHeader, content);
      dialog.append(panel);
      document.body.append(dialog);

      closeButton.addEventListener('click', function () {
        dialog.close();
      });
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) {
          dialog.close();
        }
      });
      dialog.addEventListener('close', function () {
        dialog.remove();
        expandButton.focus();
      });

      dialog.showModal();
    });
  });

  const postContent = document.querySelector('article .post-content');
  if (!postContent) {
    return;
  }

  const headings = [...postContent.querySelectorAll('h1, h2, h3')].filter(function (heading) {
    return !heading.closest('.playground-catalog');
  });
  const usedIds = new Set();

  headings.forEach(function (heading, index) {
    const headingText = heading.textContent.trim();
    let id = heading.id || heading.textContent
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    id = id || 'section-' + (index + 1);
    const baseId = id;
    let suffix = 2;
    while (usedIds.has(id) || document.getElementById(id) && document.getElementById(id) !== heading) {
      id = baseId + '-' + suffix;
      suffix += 1;
    }

    heading.id = id;
    heading.dataset.tocLabel = headingText;
    heading.style.scrollMarginTop = '1.5rem';
    usedIds.add(id);

    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = '#' + id;
    anchor.textContent = '#';
    anchor.setAttribute('aria-label', 'Link to ' + headingText);
    heading.append(anchor);
  });

  if (headings.length >= 2 && !postContent.dataset.noToc) {
    const layout = document.createElement('div');
    const postBody = document.createElement('div');
    const toc = document.createElement('aside');
    const tocDetails = document.createElement('details');
    toc.className = 'post-toc';
    toc.setAttribute('aria-label', 'Table of contents');
    tocDetails.open = false;
    layout.className = 'post-layout';
    postBody.className = 'post-body';
    postContent.classList.add('has-post-layout');

    const summary = document.createElement('summary');
    summary.textContent = 'On this page';

    const list = document.createElement('ol');
    const links = new Map();
    headings.forEach(function (heading) {
      const item = document.createElement('li');
      item.className = 'toc-level-' + heading.tagName.slice(1);

      const link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = heading.dataset.tocLabel;
      links.set(heading.id, link);
      item.append(link);
      list.append(item);
    });

    while (postContent.firstChild) {
      postBody.append(postContent.firstChild);
    }

    tocDetails.append(summary, list);
    toc.append(tocDetails);
    layout.append(postBody, toc);
    postContent.append(layout);
    const updateTocLayout = function () {
      layout.classList.toggle('toc-collapsed', !tocDetails.open);
    };
    tocDetails.addEventListener('toggle', updateTocLayout);
    updateTocLayout();

    let ticking = false;
    const updateActiveTocLink = function () {
      let activeHeading = headings[0];
      headings.forEach(function (heading) {
        if (heading.getBoundingClientRect().top <= 180) {
          activeHeading = heading;
        }
      });

      links.forEach(function (link, id) {
        const isActive = id === activeHeading.id;
        link.classList.toggle('is-active', isActive);
        if (isActive) {
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      });
      ticking = false;
    };

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(updateActiveTocLink);
        ticking = true;
      }
    }, { passive: true });
    updateActiveTocLink();
  }

  if (window.location.hash) {
    window.requestAnimationFrame(function () {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target) {
        target.scrollIntoView();
      }
    });
  }

  postContent.querySelectorAll('img').forEach(function (image) {
    image.loading = 'lazy';
    image.decoding = 'async';

    if (image.closest('figure')) {
      return;
    }

    const paragraph = image.closest('p');
    if (!paragraph || paragraph.textContent.trim() || paragraph.children.length !== 1) {
      return;
    }

    const media = image.parentElement.tagName === 'A' ? image.parentElement : image;
    const figure = document.createElement('figure');
    figure.className = 'post-figure';
    paragraph.before(figure);
    figure.append(media);

    paragraph.remove();
  });

  document.querySelectorAll('iframe[data-theme-sync="true"]').forEach(function (iframe) {
    const syncTheme = function () {
      const theme = document.documentElement.getAttribute('data-theme')
        || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

      if (!iframe.dataset.themeInitialized) {
        const source = new URL(iframe.src, window.location.href);
        source.searchParams.set('scoutTheme', theme);
        iframe.src = source.toString();
        iframe.dataset.themeInitialized = 'true';
      } else if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'scout-theme',
          theme: theme
        }, '*');
      }
    };

    iframe.addEventListener('load', syncTheme);
    syncTheme();
    new MutationObserver(syncTheme).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  });

  (function () {
    const input = document.getElementById('playground-filter');
    const catalog = document.getElementById('playground-catalog');
    if (!input || !catalog) {
      return;
    }
    const empty = document.getElementById('playground-search-empty');
    const cards = Array.from(catalog.querySelectorAll('.playground-card'));
    const index = cards.map(function (card) {
      return { card: card, text: card.textContent.replace(/\s+/g, ' ').trim().toLowerCase() };
    });

    const applyFilter = function () {
      const query = input.value.trim().toLowerCase();
      let visible = 0;
      index.forEach(function (entry) {
        const match = !query || entry.text.indexOf(query) !== -1;
        entry.card.hidden = !match;
        if (match) {
          visible += 1;
        }
      });
      if (empty) {
        empty.hidden = visible !== 0;
      }
    };

    input.addEventListener('input', applyFilter);
    applyFilter();
  })();

  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'interactive-resize') {
      return;
    }

    const iframe = Array.from(document.querySelectorAll('iframe[data-auto-height="true"]'))
      .find(function (candidate) {
        return candidate.contentWindow === event.source;
      });
    const height = Number(event.data.height);

    if (!iframe || !Number.isFinite(height)) {
      return;
    }

    iframe.style.height = Math.min(Math.max(Math.ceil(height), 320), 5000) + 'px';
  });
});
