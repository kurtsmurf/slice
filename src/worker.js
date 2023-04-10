importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");

Comlink.expose({
  computeBuckets(data, numBuckets) {
    const bucketSize = Math.ceil(data.length / numBuckets);
    const buckets = [];
    let startIndex = 0;

    for (let i = 0; i < numBuckets; i++) {
      const endIndex = startIndex + bucketSize;
      const bucket = data.subarray(startIndex, endIndex);
      const min = Math.min(...bucket);
      const max = Math.max(...bucket);
      buckets.push({ min, max });
      startIndex = endIndex;
    }

    return buckets;
  },
});
