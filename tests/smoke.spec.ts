import { expect, test } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("localhost:3000");
  await expect(page).toHaveTitle(/slice/i);
});

test.only("loads clip", async ({ page }, testInfo) => {
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
  await expect(page).toHaveScreenshot({ maxDiffPixels: 100 });
  await testInfo.attach(
    "screenshot",
    {
      body: await page.screenshot(),
      contentType: "image/png",
    },
  );
});
