interface Props {
  children: React.ReactNode;
}

export default function GlassContainer({ children }: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl min-h-screen flex flex-col px-4 py-8 gap-6">
      <div className="glass rounded-2xl p-4 md:p-6 lg:p-8 flex flex-col gap-4 md:gap-6">
        {children}
      </div>
    </div>
  );
}
