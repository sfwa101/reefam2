import BackHeader from "@/components/BackHeader";

const Page = () => {
  return (
    <div>
      <BackHeader title="الملف الشخصي" subtitle="حسابي" />
      <div className="glass-strong rounded-3xl p-8 text-center shadow-soft animate-float-up">
        <p className="font-display text-base font-bold text-foreground">الملف الشخصي</p>
        <p className="mt-2 text-sm text-muted-foreground">قريباً — المحتوى الكامل في الإصدار التالي.</p>
      </div>
    </div>
  );
};

export default Page;
