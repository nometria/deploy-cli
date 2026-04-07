/**
 * Simple terminal spinner — zero dependencies.
 */

const FRAMES = ['   ', '.  ', '.. ', '...'];

export function createSpinner(message) {
  let frameIndex = 0;
  let interval = null;
  let currentMessage = message;

  return {
    start() {
      process.stdout.write(`  ${currentMessage} `);
      interval = setInterval(() => {
        frameIndex = (frameIndex + 1) % FRAMES.length;
        process.stdout.write(`\r  ${currentMessage} ${FRAMES[frameIndex]}`);
      }, 200);
      return this;
    },

    update(msg) {
      currentMessage = msg;
    },

    succeed(msg) {
      clearInterval(interval);
      process.stdout.write(`\r  ${msg || currentMessage} \n`);
      return this;
    },

    fail(msg) {
      clearInterval(interval);
      process.stdout.write(`\r  ${msg || currentMessage} \n`);
      return this;
    },

    stop() {
      clearInterval(interval);
      process.stdout.write('\n');
    },
  };
}
