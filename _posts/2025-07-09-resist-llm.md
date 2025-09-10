---
title: Why do some Developers resist using LLMs?
layout: post
date: 2025-09-07 14:00:00 +0100
image: /assets/trani-novembre-2024.jpg
excerpt: Limiting beliefs and how to overcome them.
categories:
- Agents
lang: en
translations:
  it: /agents/2025/09/07/resist-llm-it.html
---

When I have to work on any task these days, my first thought is: how do I ask AI to do it?
Can it handle it the way I would, but in less time? 
My second thought is: damn, am I becoming dependent? My third thought is: well, let’s give it a try and see what comes out.

<div class="post-image-container">
    <img src="/assets/trani-novembre-2024.jpg" class="post-image" alt="Trani" loading="lazy" decoding="async">
    <p class="post-image-subtitle">Trani, Cold winter Evening - 2024 </p>
</div>

At this point, unless it’s a really complicated task that affects a lot of files, it usually manages to get pretty close to the solution, 
and with a couple more prompts I can wrap it up. 
And no, I don’t always ask for simple stuff or CRUD operations. 
With LLMs I built a zero-mean normalized cross-correlation algorithm for real-time analysis of two discrete signals: 
the “sentiment” of a stock and its value over time—without writing a single line of code. 
Ok, it’s not rocket science, but it’s not just “read and write” from a DB either. 
I remember back in the days of my [master’s thesis](https://drive.google.com/file/d/0B6rh8wOHUAdNSE5OOFJwMC1PTHM/view?resourcekey=0-P1hJxJPBiz3AAdo4FJn8vA), 
it took me an entire week to do pretty much the same thing.

(Spoiler: by the way, if you’re interested, I’ll soon publish an article on how to perform sentiment analysis in Java by querying a trained model like DistilRoberta – don’t worry, there’s only the bare minimum of Python needed to convert the model into something executable on the beloved JVM).

Recently I also realized that with specific instructions in the “[Agents.md](https://agents.md/)” file,  
I can even skip boring commands like “git add .” – “git commit -m” and so on. I talked about it [here](https://gaetanopiazzolla.github.io/agents/2025/09/04/ai-powered-development-workflows.html).

And yet the responses I got to that article were baffling:

![reddit-rant.png](/assets/reddit-rant.png)

Which got me thinking about why there’s still a hardcore of “old school” 
programmers who insist on shoeing horses when we’re all driving cars.

Apart from Reddit users, I personally know two or three of them, 
and I myself used to be part of the horse-shoers club. 
Back then, I used GPT-3 to create a spring-boot app from scratch without writing code, and had a terrible experience.
You can read about it [here](https://blog.gopenai.com/i-used-chatgpt-to-generate-a-springboot-app-38cb51bf34bd). I was convinced LLMs were just a hype and would never get this far. But after quite a bit of back and forth, 
and a deep crisis with a rant on [reddit](https://www.reddit.com/r/webdev/comments/1kg0h8e/what_to_do_with_llms_taking_over_im_lost/)
that I regretted (and where, of course, I got plenty of insults), I **changed my mind.**
    
Even though I don’t consider myself an AI fanboy or a vibe-coder, 
I honestly believe it’s necessary, if not mandatory, to embrace “non-deterministic” programming (as [Martin Fowler](https://martinfowler.com/articles/2025-nature-abstraction.html)
calls it) and, instead of fighting windmills, look for new software development models that include the huge potential of LLMs at various levels.

---

So I’ve identified some limiting beliefs that keep us from fully appreciating and exploring what we can do with these new tools.
I feel I’ve got an advantage because I had these same thoughts myself, and I managed (at least partly) to overcome them.

**I realize some opinions here are controversial and open to criticism; but they are what they are: opinions.** I don’t hold any public role, I’m just an ordinary developer (probably not even a very good one) 
who wants to share some thoughts (for anyone crazy enough to have read this far despite bad English and awful prose).

Here they are:

---

#### 1) If I use LLMs, everything I know is useless

False—we should know better by now. You need to understand what an LLM produces precisely because the output is non-deterministic.
**The power of LLMs comes from their randomness, which inevitably means a certain percentage of errors**. Even though that percentage will keep getting lower, it will never be zero.

In some cases (few so far, though fairly complex ones) I’ve been able to skip reading the generated code thanks to a complete test suite. But at least the test code itself needs checking: inputs and outputs must be clearly defined.

---

#### 2) If I use LLMs, soon I won’t know how to program anymore

Let’s flip that around: if you already have a development plan in mind, you can be super specific in your prompts, and raise the language level all the way to natural language. 

**Narrowing the context to the files that need changes, pointing out the critical parts of the implementation—this requires solid technical and domain knowledge**, plus good command of these tools. Technical solutions become more thought-out and less typed out. Syntax becomes less important, high-level vision becomes essential.

---

#### 3) If I use LLMs, I’m not really learning

Well, my friend, that depends entirely on you—again, on how you use the tool. 
**I see it as a great learning opportunity: reading and correcting what the LLM proposes.** 
Sometimes it spits out code you’ve never seen before, unknown libraries, crazy syntax. You ask why, and you learn, maybe even faster than before. 

If you’re using LLMs to build MVPs, then of course the focus is on maximum speed. In that case, learning is secondary. 
And honestly, after you’ve built REST APIs and CRUD dozens of times, what’s left to learn there? Delegate and review instead of banging the keyboard like a caveman!

---

#### 4) LLMs are just tools created by the powerful to avoid paying workers

Here’s where Joseph Schumpeter’s concept of “creative destruction” comes in. It’s an inherent part of capitalism, 
whether you like it or not. 

**Innovation makes technologies, trades, or even entire sectors obsolete, 
but at the same time it creates new opportunities and new forms of productivity.** 
The invention of shipping containers (the big ones on cargo ships, from which Docker containers get their name) 
was met very badly by dock workers: no more need to move boxes by hand. Now you need 2–3 crane operators instead of 300 dockworkers. 

What’s the alternative? Go back to caves so we can all work gathering berries and lighting fires?
I don’t buy the leftist rhetoric that progress is a curse for humanity.

---

#### 5) If I use LLMs, I’m cheating

As I wrote at the start, part of my current thought process is asking myself if I’m becoming dependent on LLMs.
It’s a feeling I still get. For older developers like me, maybe you remember feeling the same when looking up answers to technical problems on StackOverflow. 
That’s why in my spare time, I also tried [contributing there](https://stackoverflow.com/users/2768318/gaetano-piazzolla), to feel a little less like a cheater. 

But really, would you do without it? Do you think it’s better not to use StackOverflow or read library documentation, 
and instead decompile a JAR and spend 20 hours debugging to figure out why that damn function doesn’t work? This is a paradigm shift. 

Hard work and suffering don’t always make the result better. **Sometimes suffering is (not always) optional.** 
And if you like suffering (which is basically a synonym for debugging), well, good for you!

---

#### 6) But LLMs sell my code to Elon Musk

If the code you write is really that interesting, good for you! Mine sucks. 
It sucks so badly that I even started a blog to share the “best” parts, because they seem exceptional to me—though in reality, 
they’re barely above mediocre. But overall, **I believe today’s agents, chatbots, etc. are pretty well protected from a privacy standpoint.**

---

#### 7) When relying on LLM, I feel I'm losing professional identity

This is a more general concern. Some people think most of our job is writing repetitive commands like git add and git commit (like my Reddit friend). 
I say no. If I can just write “commit and push” instead of a flood of repetitive commands, 
why on earth shouldn’t I? Because it’s wrong 5% of the time? Honestly, I’d say it makes fewer mistakes than I do. 

Repetitive commands and syntax aren’t the core of our job. They’re just the means to an end: transmitting and storing information in a structured way. 
**Every technological revolution shifts the focus: yesterday from hoe to tractor, today from syntax to abstraction.**

---

#### 8) If I can do it the old way, and quickly too, why should I use an LLM?

Here too, I think LLMs come in handy. If you know exactly where that damn null pointer is that brought down production, 
it only takes a second to add an IF check. But then… do you need to create a test? 
And are we sure there isn’t another null pointer right after? These are all things you can do by hand… but why?

**A quick check from Claude does not hurt.** Same with this: a colleague sends you a PR to review. You look it over and find no issues. 
Then you see the “copilot review” button next to it—click it, right? What’s the harm? Better one wrong comment to resolve than a missed issue.

---

#### 9) LLMs don't work with new/old technologies and frameworks

This belief stems from the misconception that LLMs are limited to their training data cutoff. 
**The reality is that you can provide extensive context—entire documentation pages, API references, legacy codebases, or cutting-edge framework docs.** 
Modern LLMs excel at understanding patterns and applying them to new contexts when given sufficient information.

For obscure syntax or very peculiar legacy systems, yes, they might struggle initially. But here's the key: 
you can feed them the specific documentation, examples, or even existing code snippets from your project. 
**The LLM becomes a powerful pattern matcher and code translator**, helping you navigate unfamiliar territories faster than traditional trial-and-error approaches.

Whether you're working with a brand-new framework that came out last week or maintaining a COBOL system from the 80s, 
the combination of LLM reasoning capabilities plus the right context often beats starting from scratch with just Google and StackOverflow.

---

> Those who ride the wave stay afloat, those who fear it sink.

---

As always, thank you for reading.