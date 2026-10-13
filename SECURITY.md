# Security policy

## Supported versions

Only the latest version on the `main` branch, which is what the live site serves, receives fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through GitHub instead: go to the repository's **Security** tab and choose **Report a vulnerability**. Include:

- what the problem is and what an attacker could do with it;
- steps or an input that reproduces it;
- the browser and version you tested in.

You should get an acknowledgement within a few days. Once a fix ships, the report can be disclosed, with credit to you if you'd like.

## Scope

Galley runs entirely in the browser and makes no network requests. The most relevant issues are:

- script injection through pasted input or opened files (both are untrusted);
- ways around the page's Content-Security-Policy;
- input that freezes or crashes the page.

LaTeX that Galley produces is meant to be compiled by you. Raw LaTeX in your Markdown (`\commands`, `\begin{…}` blocks, `{=latex}` fences) passes through untouched by design, so treat LaTeX from untrusted sources the way you would any `.tex` file, for example `\write18` with shell escape enabled.
