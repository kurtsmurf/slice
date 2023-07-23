import { expect, test } from "@playwright/test";

test("loads clip", async ({ page }, testInfo) => {
  await page.goto("localhost:3000");
  await page.evaluate(initializePage);
  // click the center of the summary element
  await page.locator("[data-summary-element]").click();
  // double click the waveform, setting cursor and starting playback
  await page.locator("[data-content-element]").dblclick();
  // slice at cursor placed in previous step
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
  window.setClip({
    name: "sinusoid-mono",
    buffer,
  });
};

// sets clip to a stereo buffer with two sine waves a fifth apart
const initializePageAlt = () => {
  const buffer = new AudioBuffer({
    sampleRate: 44100,
    length: 44100 * 5,
    numberOfChannels: 2,
  });

  buffer.getChannelData(0).forEach((_, index, array) => {
    const progress = index / array.length;
    array[index] = Math.sin(progress * (44100/8) * Math.PI) * 0.3;
  });

  buffer.getChannelData(1).forEach((_, index, array) => {
    const progress = index / array.length;
    array[index] = Math.sin(progress * (44100/12) * Math.PI) * 0.3;
  });
    
  // @ts-ignore
  window.setClip({
    name: "stereo-fifth",
    buffer,
  });
};