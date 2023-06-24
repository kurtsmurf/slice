import { expect, test } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("localhost:3000");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/slice/i);
});

test("loads clip", async ({ page }) => {
  await page.goto("localhost:3000");
  await page.evaluate(() => {
    // @ts-ignore
    window.setClip({
      name: "hello",
      buffer: new AudioBuffer({
        sampleRate: 44100,
        length: 44100 * 60,
      })
    })
  })
  // await page.pause();
})