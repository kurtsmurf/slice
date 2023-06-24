import { expect, test } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("localhost:3000");
  await expect(page).toHaveTitle(/slice/i);
});

test("loads clip", async ({ page }, testInfo) => {
  await page.goto("localhost:3000");
  await page.evaluate(() => {
    // set clip to a 60s buffer of silence named hello
    // @ts-ignore
    window.setClip({
      name: "hello",
      buffer: new AudioBuffer({
        sampleRate: 44100,
        length: 44100 * 60,
      }),
    });
  });
  // does not wait for async canvas rendering to finish
  await testInfo.attach(
    "screenshot",
    {
      body: await page.screenshot(),
      contentType: "image/png",
    },
  );
});
