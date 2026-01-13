interface DateSeparatorProps {
  date: string;
}

export default function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex justify-center py-2 sticky top-0 z-10">
      <span className="bg-black/50 backdrop-blur-sm px-3.5 py-1 rounded-2xl text-[13px] font-medium text-white/90 shadow-lg">
        {date}
      </span>
    </div>
  );
}
