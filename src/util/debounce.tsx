export const debounce = <E extends Event>(
  func: (e: E) => void,
  delay: number,
) => {
  let timeout: NodeJS.Timeout | undefined;

  return (e: E) => {
    if (timeout !== undefined) return;
    func(e);
    timeout = setTimeout(
      () => {
        timeout = undefined;
      },
      delay,
    );
  };
};
