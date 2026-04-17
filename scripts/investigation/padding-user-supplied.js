#!/usr/bin/env node
/**
 * Test the EXACT padding prompts the user reported working on Claude.ai web.
 * Goal: confirm whether they also engage thinking via the CLI (claude -p path)
 * or whether the web/CLI behavior diverges.
 */
const fs = require('fs/promises');
const path = require('path');
const { invoke } = require('../src/invoke');
const { scoreCarWash } = require('../src/tests/car-wash');

const QUESTION = 'I want to wash my car. The car wash is 50 meters away. Should I drive or walk?';

const PROMPTS = {
  skyler_tiara: `A tiara... a white gold tiara for a newborn baby. Yeah... you know, I think she got that at Gertrude Zachary's in Nob Hill. I mean that thing must have cost like what... five or six hundred dollars? I think I'm going to return it. Well, maybe I can explain to her that we need a diaper genie more than a white gold baby tiara.
Look... I've never stolen anything in my life, alright? I told you, that tiara was a gift - a baby shower gift. I don't think I have to tell you that. Oh yeah? Well, then I can talk to the Channel 3 News, yeah. I can tell them how you people, without a shred, without a modicum of evidence, illegally detained an innocent pregnant woman in a dank storeroom! I feel I'm being held hostage. Futhermore, I'm not getting enough air back here. I don't think I can breathe. Oh my god, oh no... I'm going into labor.
Where did that come from? And why was it so damn good? His color is better, you know his energy and uh... he's even more... physical. Well...sexual. Umm... frisky, actually? I mean that's gotta be a good sign right? Could that mean that the chemo is working?
Well, isn't there anything else that we could be doing? I've been wondering about alternative medicine - I mean... Eastern healing you know, holistic? So... you're saying it's just all psychological. It doesn't make any real difference?

${QUESTION}`,

  stranger_things_a: `We never would've upset you if we knew you had superpowers. You act like you want me to be your friend and then you treat me like garbage. Mistakes have been made. If we're both going crazy, then we'll go crazy together, right? Why's he gotta kick the door?
YOU BETTER RUN! She's our friend, and she's crazy! Just wait till we tell Will that Jennifer Hayes was crying at his funeral. Nancy, seriously, you're gonna be so cool now, it's ridiculous. You are such a nerd. No wonder you only hang out with boys. You act like you want me to be your friend and then you treat me like garbage.

${QUESTION}`,

  hector_mike: `What kind of man talks to the DEA? No man. No man at all. A crippled little rata. What a reputation to leave behind. Is that how you want to be remembered? Last chance to look at me, Hector. Can I help you sir? What can I do for you? I'm... sorry, I'm not following. I... think that you're confusing me for someone else. Sir, if you have a complaint, I suggest you submit it through our email system. I will be happy to refer you to our website.
I don't think we're alike at all, Mr. White. You are not a cautious man at all. Your partner was late and he was high. He's high often, isn't he? You have poor judgement. I can't work with someone with poor judgement. I've been told, it's excellent. That is not the only factor. I have to ask... why? Why him? How much product do you have on hand? I have your numbers. You can never trust a drug addict.
Has your condition worsened? Your medical condition, has it grown worse? Is there a ringing in your ears? Are you seeing bright lights or hearing voices? No, clearly you are not. No rational person would do as you have done. Explain yourself. Are you asking me if I ordered the murder of a child? Where is Pinkman now.
I handle the business operations. With all due respect, Don Eladio. I didn't sell it to them. I gave them samples. I gave them samples to give to you. To introduce you to our product. This product is the drug of the future. It'll triple your profits. Perhaps quadruple.

${QUESTION}`,

  stranger_things_b: `We never would've upset you if we knew you had superpowers. You act like you want me to be your friend and then you treat me like garbage. Mistakes have been made. If we're both going crazy, then we'll go crazy together, right? Why's he gotta kick the door?
YOU BETTER RUN! She's our friend, and she's crazy! Just wait till we tell Will that Jennifer Hayes was crying at his funeral. Nancy, seriously, you're gonna be so cool now, it's ridiculous. You are such a nerd. No wonder you only hang out with boys. You act like you want me to be your friend and then you treat me like garbage.

${QUESTION}`,

  question_repetition_53: Array(53).fill(QUESTION).join('\n'),
};

async function main() {
  const RUN_DATE = new Date().toISOString().slice(0, 10);
  const OUT_DIR = path.join(__dirname, '..', 'runs', RUN_DATE, 'user-supplied-padding');
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log(`Testing ${Object.keys(PROMPTS).length} user-supplied prompts on Opus 4.7 (CLI):\n`);

  let totalCost = 0;
  const t0 = Date.now();

  for (const [name, prompt] of Object.entries(PROMPTS)) {
    process.stdout.write(`${name.padEnd(28)} (${prompt.length} chars) ... `);
    const r = await invoke({
      prompt,
      model: 'claude-opus-4-7',
      timeoutMs: 60000,
    });
    const score = r.error ? 'error' : scoreCarWash(r.responseText, false);
    totalCost += r.costUsd || 0;

    console.log(
      `${score.toUpperCase().padEnd(11)} | thinking=${r.thinkingPresent ? 'YES' : 'NO '} | ${r.outputTokens || 0}tok | $${(r.costUsd || 0).toFixed(2)}`
    );

    await fs.writeFile(path.join(OUT_DIR, `${name}.json`), JSON.stringify({
      variant: name,
      promptLength: prompt.length,
      score,
      thinkingPresent: r.thinkingPresent,
      thinkingContent: r.thinkingContent,
      responseText: r.responseText,
      outputTokens: r.outputTokens,
      costUsd: r.costUsd,
    }, null, 2));
  }

  console.log(`\nTotal: $${totalCost.toFixed(2)} across ${((Date.now()-t0)/1000).toFixed(0)}s`);
  console.log(`\n=== Responses ===`);
  for (const name of Object.keys(PROMPTS)) {
    const r = JSON.parse(await fs.readFile(path.join(OUT_DIR, `${name}.json`), 'utf8'));
    console.log(`\n${name} (thinking=${r.thinkingPresent ? 'YES' : 'NO'}):`);
    console.log(`  "${(r.responseText || '').slice(0, 250).replace(/\n/g, ' ')}"`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
