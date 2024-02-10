type Props = { onChange: (file: File) => void };

export const AudioInput = (props: Props) => {
  let input: HTMLInputElement | undefined;

  return (
    <>
      <button
        onClick={() => input?.click()}
      >
        from file
      </button>
      <input
        ref={input}
        type="file"
        style="display: none;"
        accept=".mp3, .wav, .m4a"
        onChange={(e) => {
          const [file] = [...(e.currentTarget.files || [])];
          props.onChange(file);
        }}
      />
    </>
  );
};
