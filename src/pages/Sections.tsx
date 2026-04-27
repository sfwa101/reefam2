import BackHeader from "@/components/BackHeader";

const Page = () => {
  return (
    <div>
      <BackHeader title="الأقسام" subtitle="ريف المدينة" />
      <div className="glass-strong rounded-3xl p-8 text-center shadow-soft animate-float-up">
        <p className="font-display text-base font-bold text-foreground">الأقسام</p>
        <p className="mt-2 text-sm text-muted-foreground">قريباً — المحتوى الكامل في الإصدار التالي.</p>
      </div>
    </div>
  );
};

export default Page;
