import { expect, test } from "@playwright/test";

test("loads clip", async ({ page }, testInfo) => {
  await page.goto("localhost:3000");

  // set clip to a buffer with a sinusoid wave
  await page.evaluate(() => {
    const buffer = new AudioBuffer({
      sampleRate: 44100,
      length: 44100 * 5,
    });

    buffer.getChannelData(0).fill(1);
    buffer.getChannelData(0).forEach((_, index, array) => {
      const progress = index / array.length;
      for (let i = 1; i < 16; i *= 2) {
	// quick maths
        array[index] *= Math.sin(progress * i * 4 * Math.PI);
      }
    });

    // @ts-ignore
    window.setClip({
      name: "hello",
      buffer,
    });
  });
  // click the center of the summary element
  // should scroll view to halfway point of waveform
  await page.locator("[data-summary-element]").click();
  // double click in the center of the visible waveform area
  await page.locator("[data-content-element]").dblclick();
  // stop playback
  await page.getByText(/stop/i).click();
  // drop a flag at cursor placed in previous step
  await page.getByText(/drop a flag/i).click();
  // perform visual diff
  await expect(page).toHaveScreenshot({ maxDiffPixels: 100 });
  // attach screenshot to result
  await testInfo.attach(
    "screenshot",
    {
      body: await page.screenshot(),
      contentType: "image/png",
    },
  );
});
