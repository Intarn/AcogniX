export default function EmptyState({
  title = 'No data available',
  description = ''
}) {
  return (
    <div
      className="
        flex
        flex-col
        items-center
        justify-center
        p-8
        text-center
      "
    >
      <h3
        className="
          text-lg
          font-semibold
          text-gray-800
        "
      >
        {title}
      </h3>

      {description && (
        <p
          className="
            mt-2
            max-w-md
            text-sm
            text-gray-500
          "
        >
          {description}
        </p>
      )}
    </div>
  );
}