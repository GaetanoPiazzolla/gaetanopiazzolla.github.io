---
title: Stop Writing Boring Git Commands - Let AI Handle Your Entire Development Workflow
image: /assets/git-workflow-llm.png
layout: post
date: 2025-09-04 06:00:00 +0100
excerpt: If you're still manually typing Git commands you're missing out on a massive productivity boost.
categories:
  - Agents
---

Welcome to the age of AI-powered development workflows.

Natural language replaces memorizing dozens of Git commands, and your coding assistant handles everything from branch creation to PR descriptions.

<div align="center">
    <img src="/assets/git-workflow-llm.png" style="content-visibility:auto" alt="AI-powered Git workflows" loading="lazy" decoding="async">
</div>

## The Old Way vs. The AI Way

**Before:** You're a human command-line encyclopedia
- Remember to check out master and pull latest changes
- Create a branch with the right naming convention (`TICKET-123-fix-auth-bug`)
- Write code, then remember the exact sequence: clean → format → generate APIs → test → integration test
- Write a commit message that doesn't sound like "fixed stuff"
- Navigate to GitHub and create a PR with a description that actually explains what you did
- Forget at least 2 steps, push broken code, feel shame

**After:** You're a productivity wizard
```
You: "follow the workflow for building and uploading my changes"
AI: *Creates properly named branch, runs full test suite, formats code, 
     generates commit message with ticket prefix, creates detailed PR*
You: *Goes to grab a huge coffee while feeling superior to your past self*
```

This isn't science fiction. This is Wednesday.

## The Magic Behind the Curtain: AGENTS.md Standard

The secret sauce lies in a simple file that's revolutionizing how we work with AI: `AGENTS.md`. 
Following the [agents.md](https://agents.md/) specification, this standardized format has already been adopted by **over 20,000 repositories** 
and is backed by OpenAI, Google, Anthropic, Cursor, and other major AI companies.

Think of `AGENTS.md` as a "README for robots" – it tells your AI assistant exactly how your team works, what your conventions are, and what workflows to follow.

### How AGENTS.md Works

The specification is beautifully simple: it's just **standard Markdown with no required fields**. Your AI assistant automatically reads these files and uses them as context for every interaction. Here's the magic part – you can place them anywhere in your project hierarchy:

- **Repository root** (`/AGENTS.md`): General project guidelines
- **Subdirectories** (`/backend/AGENTS.md`): Area-specific instructions  
- **Home directory** (`~/.AGENTS.md`): Your personal coding preferences

More specific files override general ones, creating a cascading system where the closest instruction file to your current work takes precedence.

## Essential Setup: CLI Tools

Before diving into workflows, you'll need the right tools. The `gh` CLI is probably the most underutilized tool in modern development. While you're clicking through GitHub's web interface, AI agents are using `gh pr create --fill --draft` to create perfect PRs in milliseconds.

**Required installations:**
- [GitHub CLI (`gh`)](https://github.com/cli/cli?tab=readme-ov-file#installation) for GitHub repositories
- [GitLab CLI (`glab`)](https://gitlab.com/gitlab-org/cli#installation) for GitLab repositories

Once installed, authenticate with `gh auth login` or `glab auth login` respectively.

{% include in-article-ad.html %}

### Creating Your AGENTS.md File

Here's how to transform your git workflow with a simple file in your project root:

```markdown
# Development Workflow Instructions

When asked to "follow the workflow" or "build and upload changes", 
follow those instructions.

## Branching Strategy
You need to create a branch against updated master 
following the pattern: `<JIRA_TICKET_NUMBER>-<brief-description>`

Ask for the Jira ticket number if not provided.

## Build Process 

Always execute these commands in sequence:
1. `./gradlew clean`
2. `./gradlew compileJava compileTestJava`
3. `./gradlew spotlessApply`
4. `./gradlew test`
5. `./gradlew integrationTest`
6. `./gradlew build`

For endpoint changes, ensure integration tests are added.
For service layer changes, unit tests are sufficient.

## Commit Guidelines
- Format: "TICKET-123 | Brief description"  
- Keep commit messages concise but descriptive
- Include all modified files and generated artifacts

## GitHub CLI Operations
Use GitHub CLI (`gh`) for all repository operations:
- `gh pr create --fill` for standard PRs with auto-generated title and description
- `gh pr create --draft` for work-in-progress PRs
- `gh pr create --fill --assignee @me` to auto-assign yourself
- Include meaningful descriptions and link relevant issues
- Always target the master branch unless specified otherwise

## Publishing
Create pull requests using GitHub CLI against master branch.
Include meaningful PR descriptions explaining the changes and their impact.
```

Needless to say you can customize this workflow as you whish (especially the Build part).
The end goal is to just write "follow the workflow to publish my changes" to avoid doing repetitive work.

Here you can see one of the latest iteractions I had with copilot, while publishing my code:

<div align="center">
    <img src="/assets/workflow-example.png" style="content-visibility:auto" alt="AI-powered Git workflows example" loading="lazy" decoding="async">
</div>


### IDE-Specific Setup

All AI assistants automatically read instructions from your root `AGENTS.md` file. Additionally, you can create IDE-specific instruction files that work alongside the main AGENTS.md:

**GitHub Copilot:** `.github/copilot-instructions.md`  
**Cursor:** `.cursor/rules/main.mdc`  
**Claude:** Requires explicit reference to your AGENTS.md file in conversations (e.g., "Follow the instructions in our AGENTS.md file").

These IDE-specific files supplement the main AGENTS.md instructions and can contain tool-specific preferences or workflows while maintaining consistency across your team.

## From "git add ." to "Ship It" - Complete Automation

Let's break down what we can achieve when saying "follow the workflow" in the IDE chat:

**Smart Branching:** Your AI creates branches like `AUTH-456-implement-oauth-flow` based on your ticket system and change description. No more `feature/stuff` or `john-fixes-thing`.

**Intelligent Testing:** The AI knows when to run unit tests vs. integration tests based on your changes. Touching an endpoint? Integration tests automatically included. Service layer changes only? Unit tests suffice.

**Code Quality Gates:** Automatic code formatting, because consistent code style shouldn't depend on remembering to run a command.

**Smart Commits:** Instead of "fix bug" you get "AUTH-456 - Implement OAuth 2.0 flow with refresh token support". The AI reads your code changes and generates meaningful commit messages with proper ticket prefixes.

**Intelligent PRs:** Your pull request description explains what changed, why it changed, and includes relevant test information. All generated from your code changes and commit history.

## Real-World Impact: What This Means for Teams

**Consistency at Scale:** Every developer, from junior to senior, now follows the same high-quality process. No more "I forgot to run tests" or "oops, wrong commit message format."

**Zero Cognitive Load:** Mental energy goes to solving problems, not remembering process steps. Your brain can focus on the hard stuff.

**Onboarding Acceleration:** New team members become productive immediately. The AI knows your workflows better than your documentation.

**Quality by Default:** Code formatting, testing, and API generation happen automatically. Quality becomes a side effect, not a goal you have to remember to pursue.

## Important Considerations

While AI-powered workflows offer tremendous benefits, there are some considerations to keep in mind:

**Learning Curve:** Teams need time to adjust to natural language commands and trust the AI's decisions. Start with simple workflows and gradually expand.

**Customization Requirements:** Your `AGENTS.md` file needs regular updates as your processes evolve. Treat it as living documentation that grows with your team.

**Fallback Knowledge:** Developers should still understand the underlying Git commands. AI enhances productivity but shouldn't replace fundamental knowledge.

**Context Awareness:** AI assistants work best when they understand your project structure and conventions. The more detailed your `AGENTS.md`, the better the results.

## The Bottom Line

We're not talking about replacing developers with AI. We're talking about replacing the boring, repetitive, error-prone parts of development with AI so developers can focus on the interesting problems.

If you're still manually typing `git add . && git commit -m "fix"`, you're missing out on a massive productivity boost. Your AI assistant is sitting there, ready to handle your entire development pipeline with a single natural language command.

The question isn't whether AI will automate development workflows - it already has. The question is whether you'll adopt these practices now or continue doing things the hard way.

**Share this with your team** - because who has time for manual git workflows in 2025?

---

*Ready to automate your development workflow? Create your AGENTS.md file today and watch your productivity transform. Your future self will thank you.*

**Resources:**
- [AGENTS.md Specification](https://agents.md/)
- [GitHub Copilot Instructions Guide](https://docs.github.com/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)
- [Example AGENTS.md Files](https://github.com/search?q=path%3A**%2FAGENTS.md&type=code)