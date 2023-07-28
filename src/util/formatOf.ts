export const formatOf = (buffer: AudioBuffer) => {
  switch (buffer.numberOfChannels) {
    case (1):
      return "mono";
    case (2):
      return "stereo";
    default:
      return buffer.numberOfChannels + " channels";
  }
};
