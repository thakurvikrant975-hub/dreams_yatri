import { SectionHeaderProps } from "@/app/types/home";
import { Heading, Text } from "./Typography";
import { motion } from "framer-motion";
import { fadeRight, fadeUp, zoomPop, staggerContainer } from "@/app/lib/motionPresets";
import { cn } from "@/lib/utils";

export default function SectionHeader({
  tag,
  title,
  subtitle,
  icon: Icon,
  noAnimation = false,
  className,
  children,
}: SectionHeaderProps & { noAnimation?: boolean }) {
  // When noAnimation is set (e.g. on the home page) skip the view-trigger props
  // so child variants stay inert and the header renders statically.
  const containerAnim = noAnimation
    ? {}
    : {
        initial: "hidden" as const,
        whileInView: "visible" as const,
        viewport: { once: false, amount: 0.3 },
      };

  return (
    <motion.div
      className={cn("mb-10 flex gap-4", className)}
      variants={staggerContainer(0.12, 0)}
      {...containerAnim}
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
      {children}
    </motion.div>
  );
}