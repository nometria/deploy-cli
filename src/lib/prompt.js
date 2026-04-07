/**
 * Interactive prompts using native readline.
 */
import { createInterface } from 'node:readline';

function createReadline() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export function ask(question, defaultValue = '') {
  return new Promise((resolve) => {
    const rl = createReadline();
    const suffix = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`  ${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

export function askSecret(question) {
  return new Promise((resolve) => {
    const rl = createReadline();
    // Mute output for secret input
    const originalWrite = process.stdout.write.bind(process.stdout);
    rl.question(`  ${question}: `, (answer) => {
      process.stdout.write = originalWrite;
      console.log(); // newline after hidden input
      rl.close();
      resolve(answer.trim());
    });
    // Hide typed characters
    process.stdout.write = (chunk) => {
      if (typeof chunk === 'string' && !chunk.includes(question)) {
        return originalWrite('*');
      }
      return originalWrite(chunk);
    };
  });
}

export function choose(question, options, defaultIndex = 0) {
  return new Promise((resolve) => {
    console.log(`\n  ${question}\n`);
    options.forEach((opt, i) => {
      const marker = i === defaultIndex ? '>' : ' ';
      console.log(`  ${marker} ${i + 1}. ${opt}`);
    });
    const rl = createReadline();
    rl.question(`\n  Choose [${defaultIndex + 1}]: `, (answer) => {
      rl.close();
      const idx = answer.trim() ? parseInt(answer) - 1 : defaultIndex;
      if (idx >= 0 && idx < options.length) {
        resolve(options[idx]);
      } else {
        resolve(options[defaultIndex]);
      }
    });
  });
}

export function confirm(question, defaultYes = true) {
  return new Promise((resolve) => {
    const rl = createReadline();
    const hint = defaultYes ? 'Y/n' : 'y/N';
    rl.question(`  ${question} (${hint}): `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (!a) return resolve(defaultYes);
      resolve(a === 'y' || a === 'yes');
    });
  });
}
