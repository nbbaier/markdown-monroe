---
title: Frontmatter fixture
description: >-
   A document whose leading block is parsed as YAML frontmatter.
tags:
   - preview
   - metadata
keywords: frontmatter, yaml, monroe
author:
   name: Monroe
   site: https://example.com/monroe
draft: false
revision: 4
---

# Frontmatter fixture

Everything above the first heading is metadata. It renders in the panel at the top of Preview mode and is hidden from the body, Code, and Raw views.

## Ordinary body content

The rest of the document renders normally: **strong emphasis**, _emphasis_, a [safe link](https://example.com/monroe), and a fenced code block.

```ts
const revision = 4;
```
