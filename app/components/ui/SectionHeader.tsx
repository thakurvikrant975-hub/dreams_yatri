import { SectionHeaderProps } from "@/app/types/home";
import { Heading, Text } from "./Typography";
import { motion } from "framer-motion";
import { fadeRight, fadeUp, zoomPop, staggerContainer } from "@/app/lib/motionPresets";

export default function SectionHeader({ tag, title, subtitle, icon: Icon }: SectionHeaderProps) {
  return (
    <motion.div
      className="mb-10 flex gap-4"
      variants={staggerContainer(0.12, 0)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.3 }}
    >
      {Icon && (
        <motion.div variants={zoomPop}>
          <Icon className="size-12" />
        </motion.div>
      )}

      <div>
        <motion.div variants={fadeRight}>
          <Text size='sm' weight='medium' intent='brand'>{tag}</Text>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-2">
          <Heading level={2}>
            {title}
          </Heading>
        </motion.div>

        {subtitle && (
          <motion.div variants={fadeUp}>
            <Text intent='secondary'>{subtitle}</Text>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}