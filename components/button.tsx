import {FiChevronRight} from "react-icons/fi";
import Link from "next/link";

export default function AndronixButton({
                                           link,
                                           children,
                                           className
                                       }: { link: string, children?: any, className?: string }) {
    return (
        <Link href={link}
              className={`${className} px-3 flex space-x-2 my-4 items-center justify-center py-2 bg-orange-500 rounded-md w-fit cursor-pointer hover:scale-105 transform transition duration-200`}>
            <span className={'text-bold text-white'}>{children}</span>
            <FiChevronRight/>
        </Link>
    )
}