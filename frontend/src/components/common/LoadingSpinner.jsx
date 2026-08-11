export default function LoadingSpinner({
  text = 'Loading...'
}) {
  return (
    <div
      className="
        flex
        items-center
        justify-center
        gap-3
        p-4
      "
    >
      <div
        className="
          h-6
          w-6
          animate-spin
          rounded-full
          border-2
          border-gray-300
          border-t-blue-600
        "
      />

      <span className="text-sm text-gray-600">
        {text}
      </span>
    </div>
  );
}