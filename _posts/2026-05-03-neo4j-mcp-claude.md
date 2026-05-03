---
title: "Integrating Neo4j with Claude Code via MCP: A Complete Guide"
layout: post
date: 2026-05-03 18:00:00 +0200
image: /assets/neo4j_mcp_cover.png
excerpt: An end-to-end guide to run a local Neo4j instance, populate it with sample data, and connect it to Claude Code using the Model Context Protocol (MCP).
categories:
  - Graph Database
  - AI
  - Claude
lang: en

---

The Model Context Protocol (MCP) is revolutionizing how we connect LLMs to our data sources. If you've been working with knowledge graphs and LLMs, you probably know how powerful it is to give AI the ability to directly query and inspect graph databases.

{% include image.html src="/assets/neo4j_mcp_cover.png" alt="Neo4j MCP Claude Integration" %}

In this article, I'll walk you through an end-to-end guide to run a local Neo4j instance, populate it with sample data, and connect it to Claude Code in two ways:
1. Directly via the official Neo4j MCP server.
2. Wrapped in a Claude Code skill that adds a procedural layer for schema inspection, error recovery, and result ranking.

We'll also cover **MCPorter** — a CLI that proxies MCP calls as plain shell commands — for token-sensitive setups and use outside of Claude.

## Repository

The complete source code and configuration for this tutorial is available on GitHub:

**[https://github.com/GaetanoPiazzolla/neo4j-mcp](https://github.com/GaetanoPiazzolla/neo4j-mcp)**

---

## 1. Start Neo4j

First, we need to spin up a local Neo4j instance using Docker.

```bash
docker compose up -d
```

Verify the server is running by navigating to [http://localhost:7474](http://localhost:7474).

| Field    | Value        |
|----------|--------------|
| User     | `neo4j`      |
| Password | `neo4jneo4j` |

To stop the container later, you can simply run `docker compose down`.

---

## 2. Populate the Database

An empty graph database isn't much fun to query. My import script creates the target database and loads the classic **Northwind dataset** (products, categories, suppliers, customers, orders).

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run_import.py
```

Expected output:
```text
Database 'mcp-test' ready.
Connected. Running 14 statement(s) from northwind.cypher
...
Import complete.
```
*(Note: The script is idempotent, so you can run it multiple times safely.)*

---

## 3. Install the neo4j-mcp Binary

Next, download the `neo4j-mcp` binary for your platform from the [official releases page](https://github.com/neo4j/mcp/releases).

**macOS (Apple Silicon):**
```bash
curl -L https://github.com/neo4j/mcp/releases/latest/download/neo4j-mcp_Darwin_arm64.tar.gz | tar xz neo4j-mcp
sudo mv neo4j-mcp /usr/local/bin/
```

**macOS (Intel):**
```bash
curl -L https://github.com/neo4j/mcp/releases/latest/download/neo4j-mcp_Darwin_x86_64.tar.gz | tar xz neo4j-mcp
sudo mv neo4j-mcp /usr/local/bin/
```

**Linux (amd64):**
```bash
curl -L https://github.com/neo4j/mcp/releases/latest/download/neo4j-mcp_Linux_x86_64.tar.gz | tar xz neo4j-mcp
sudo mv neo4j-mcp /usr/local/bin/
```

Verify the installation:
```bash
neo4j-mcp -v  
```

---

## 4. Register neo4j-mcp in Claude Code

Now for the magic part: adding the MCP server to Claude Code so the LLM can query our graph.

```bash
claude mcp add \
      --transport stdio \
      -e NEO4J_URI=bolt://127.0.0.1:7687 \
      -e NEO4J_USERNAME=neo4j \
      -e NEO4J_PASSWORD=neo4jneo4j \
      -e NEO4J_DATABASE=neo4j \
      -e NEO4J_READ_ONLY=true \
      -- neo4j-mcp neo4j-mcp
```

Verify that the MCP was added correctly:
```bash
claude mcp list 
```

Claude Code now has three powerful tools available against your local database:
- `get-schema`: Inspect labels, relationship types, and properties.
- `read-cypher`: Run read-only Cypher queries.
- `write-cypher`: Run write queries.

Try asking Claude Code questions like:
- *What products are currently in stock?*
- *Which customers have placed the most orders?*
- *What are the top 5 most expensive products?*
- *Which suppliers provide beverages?*

---

## The Power of Claude Code Skills

The MCP server gives Claude the tools. A **skill** gives it the judgment to use them well.

A skill is a markdown file loaded on-demand into Claude's context when invoked. It sits above the raw MCP layer and encodes decisions that the model would otherwise have to infer: inspect the schema before writing Cypher, retry with a reformulated query before surfacing an error, or re-rank results by relevance rather than returning whatever the query happened to return. The LLM runs that logic natively between tool calls, chaining schema inspection, querying, and summarization within a single turn.

You can find the sample skill in my repo at `.claude/skills/neo4j-query/SKILL.md`. It directly calls the registered MCP tools:
```text
mcp__neo4j-mcp__get-schema
mcp__neo4j-mcp__read-cypher  { query: "<CYPHER>" }
```

---

## What is MCPorter?

[MCPorter](https://github.com/steipete/mcporter) is a Node.js CLI that proxies calls to any MCP server as plain shell commands — useful for scripting, CI, or calling MCP tools from outside Claude entirely. 

When `neo4j-mcp` is registered in Claude Code natively, its full tool schema loads into **every conversation**, including ones that never touch the database. For large schemas or setups where every token counts, that overhead is constant and unavoidable.

A skill backed by MCPorter trades that for on-demand loading: the markdown enters context only when the skill is invoked, and the MCP registration can be removed entirely.

Install it globally:
```bash
npm install -g mcporter
```

### Configure MCPorter

Create a configuration file at `~/.mcporter/mcporter.json`:

```json
{
  "mcpServers": {
    "neo4j-mcp": {
      "command": "neo4j-mcp",
      "env": {
        "NEO4J_URI": "${NEO4J_URI}",
        "NEO4J_USERNAME": "${NEO4J_USERNAME}",
        "NEO4J_PASSWORD": "${NEO4J_PASSWORD}",
        "NEO4J_DATABASE": "${NEO4J_DATABASE:-neo4j}",
        "NEO4J_READ_ONLY": "${NEO4J_READ_ONLY:-true}"
      }
    }
  }
}
```

Load your `.env` file credentials and test it out via function-call syntax:
```bash
export $(grep -v '^#' .env | xargs)
mcporter call 'neo4j-mcp.read-cypher(query: "MATCH (p:Product) RETURN p.productName LIMIT 5")'
```

### The CLI-Variant Skill

You can create a Claude Code skill that leverages this CLI setup, exporting credentials and executing `mcporter` via the `Bash` tool. You'll find an example of this in the repo at `.claude/skills/neo4j-query-cli/SKILL.md`.

---

## Conclusion: MCP, CLI, or both?

For most use cases, adding the MCPorter path introduces complexity without much payoff. Registering the MCP server directly allows the model to reason natively between tool calls and effortlessly perform error recovery. The token overhead from the MCP server schema is real, but for local development and experimentation, it rarely matters.

However, MCPorter shines in two specific scenarios:
1. **Token-sensitive setups** where loading the schema on every conversational turn is genuinely costly.
2. **Scripting and CI/CD**, where its value has nothing to do with Claude at all. Once configured, any terminal or script can invoke Neo4j through the exact same MCP interface.

| Approach | When it makes sense |
|---|---|
| **Native MCP + Skill** | Default. Simplest setup, full LLM reasoning, no extra tooling. |
| **MCP removed + MCPorter CLI Skill** | Token-sensitive setups where schema overhead matters. |
| **MCPorter standalone** | Scripting, CI, or calling MCP tools from outside Claude entirely. |

Integrating graph databases with AI agents unlocks an entirely new layer of context and accuracy for your LLMs. Give this setup a try, and let me know how you leverage the Neo4j MCP in your workflows!
