export const sortedIndex = (arr: number[], value: number) => {
  let low = 0;
  let high = arr.length;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid] < value) {
      low = mid + 1;
    } else if (arr[mid] > value) {
      high = mid - 1;
    } else {
      return mid;
    }
  }
  return low;
};
