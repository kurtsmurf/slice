import { expect, test } from "@playwright/test";

test("player", async ({ page }, testInfo) => {
  await page.goto("https://localhost:3000");
  // load player output
  await page.evaluate(renderAudio);
  // zoom all the way in
  const zoomInBtn = await page.getByRole("button", { name: "zoom in" });
  for (let i = 0; i < 10 && await zoomInBtn.isEnabled(); i++) {
    await page.getByRole("button", { name: "zoom in" }).click();
  }
  // perform visual diff
  await expect(page).toHaveScreenshot();
  // attach screenshot to result
  await testInfo.attach(
    "screenshot",
    {
      body: await page.screenshot(),
      contentType: "image/png",
    },
  );
});

const renderAudio = async () => {
  const inputBuffer = new AudioBuffer({
    sampleRate: 44100,
    length: 44100 * 5,
  });
  inputBuffer.getChannelData(0).forEach((_, index, array) => {
    array[index] = Math.sin(index / 50);
  });

  const region = { start: 0, end: 1 };
  const offlineAudioContext = new OfflineAudioContext(
    inputBuffer.numberOfChannels,
    inputBuffer.duration * inputBuffer.sampleRate * (region.end - region.start),
    inputBuffer.sampleRate,
  );

  // @ts-ignore
  const player = window.createPlayer(offlineAudioContext);

  // schedule playback
  player.play(inputBuffer, region);

  // render result
  const resultBuffer = await offlineAudioContext.startRendering();

  // load the result
  // @ts-ignore
  window.dispatch({
    type: "setClip",
    clip: {
      name: "unknown",
      buffer: resultBuffer,
    }
  })
};
