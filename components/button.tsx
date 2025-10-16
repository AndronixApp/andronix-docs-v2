import {FiChevronRight} from "react-icons/fi";
import Link from "next/link";

export default function AndronixButton({
                                           link,
                                           children,
                                           className
                                       }: { link: string, children?: any, className?: string }) {
    return (
        <Link href={link}
              className={`${className} inline-flex items-center gap-1 text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 underline decoration-orange-600/30 dark:decoration-orange-400/30 underline-offset-4 hover:decoration-orange-600 dark:hover:decoration-orange-400 transition-colors`}>
            <span>{children}</span>
            <FiChevronRight className="w-4 h-4"/>
        </Link>
    )
}