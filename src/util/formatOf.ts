export const formatOfAudioBuffer = (buffer: AudioBuffer) => {
  return formatOfChannels(buffer.numberOfChannels);
};

export const formatOfChannels = (channels: number) => {
  switch (channels) {
    case (1):
      return "mono";
    case (2):
      return "stereo";
    default:
      return channels + " channels";
  }
};
