import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, Phone, MapPin } from 'lucide-react';
import { Image } from '@/components/ui/image';
import OrderFormSection from './OrderFormSection';

const HERO_IMAGE = '/spark/app/app_17aq22wyyy0/runtime/api/v1/storage/object/bucket_aadkmix5t46eq_static/static%2Faadkmivd5tggq_ve_miaoda';

export default function OrderFormPage() {
  const [searchParams] = useSearchParams();
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const srcParam = searchParams.get('src');
    if (srcParam) {
      setSrc(srcParam);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      {/* Hero 区 */}
      <section className="relative w-full">
        <div className="relative h-48 w-full overflow-hidden md:h-64">
          <Image
            src={HERO_IMAGE}
            alt="云南野生菌自然森林"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#171611]/30 via-[#171611]/20 to-[#FAF8F3]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-center text-white"
            >
              <div className="mb-2 flex items-center justify-center gap-2">
                <Leaf className="h-5 w-5" />
                <span className="text-sm font-medium tracking-widest">菌鲜到</span>
              </div>
              <h1 className="text-2xl font-medium tracking-wide md:text-3xl">
                云南野生菌订购登记
              </h1>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 表单主体 */}
      <main className="w-full pb-16 pt-8 md:pb-24 md:pt-12">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          {/* 表单说明 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 rounded-lg border border-[#D4D8CD] bg-white/60 p-4 text-sm leading-relaxed text-[#4A5D42] backdrop-blur-sm"
          >
            <p>
              本表单用于登记云南野生菌购买需求。野生菌品种、价格和库存每天可能变化，提交后将由工作人员通过微信或电话确认当天到货情况、实际价格和配送时间。
              <span className="font-medium">本表单不直接收款。</span>
            </p>
          </motion.div>

          {/* 表单 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <OrderFormSection initialSrc={src} />
          </motion.div>

          {/* 底部联系信息 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 flex flex-col items-center gap-2 text-xs text-[#6B7280] md:flex-row md:justify-center md:gap-6"
          >
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              <span>咨询电话：138-xxxx-xxxx</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span>昆明市官渡区</span>
            </div>
          </motion.div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="w-full border-t border-[#E8E6DF] bg-[#FAF8F3] py-6">
        <div className="mx-auto max-w-2xl px-4 text-center text-xs text-[#6B7280] md:px-6">
          <div className="mb-1 flex items-center justify-center gap-1.5">
            <Leaf className="h-3 w-3 text-[#4A5D42]" />
            <span className="font-medium text-[#4A5D42]">菌鲜到</span>
          </div>
          <p>© 2026 菌鲜到 · 云南野生菌 · 新鲜直达</p>
        </div>
      </footer>
    </div>
  );
}
