import { expect, test } from "@playwright/test";

test("loads clip", async ({ page }, testInfo) => {
  await page.goto("localhost:3000");
  await page.evaluate(initializePage);
  // click center of summary element to jump to center of waveform
  await page.locator("[data-summary-element]").click();
  // double click waveform to place cursor
  await page.locator("[data-content-element]").dblclick();
  // slice at cursor
  await page.getByText(/slice/i).click();
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

// sets clip to a buffer with a sinusoid wave
const initializePage = () => {
  const buffer = new AudioBuffer({
    sampleRate: 44100,
    length: 44100 * 5,
  });

  buffer.getChannelData(0).fill(1);
  buffer.getChannelData(0).forEach((_, index, array) => {
    const progress = index / array.length;
    for (let i = 1; i <= 8; i *= 2) {
      array[index] *= Math.sin(progress * i * 4 * Math.PI);
    }
  });

  // @ts-ignore
  window.dispatch.setClip({
    name: "sinusoid-mono",
    buffer,
  });
};
