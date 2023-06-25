import { expect, test } from "@playwright/test";

test("loads clip", async ({ page }, testInfo) => {
  await page.goto("localhost:3000");
  await page.evaluate(() => {
    // set clip to a buffer of silence named hello
    // @ts-ignore
    window.setClip({
      name: "hello",
      buffer: new AudioBuffer({
        sampleRate: 44100,
        length: 44100 * 6,
      }),
    });
  });
  // double click in the center of the visible waveform area
  await page.locator("[data-scroll-root]").dblclick();
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
