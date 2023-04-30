import Link from "next/link";
import Badge from "./badge";

export default function Card({badgeText, href, title, icon, children, className}: {
    badgeText?: string,
    href: string,
    title: string,
    icon: any,
    children: any,
    className: string
}) {
    const Icon = icon
    return (
        <Link href={href}>
            <div
                className={"overflow-clip rounded-md dark:bg-neutral-900 bg-gray-100  dark:hover:bg-neutral-800 hover:bg-neutral-200 cursor-pointer border-2 border-neutral-300 dark:border-neutral-700 p-3 " + " " + className}>
                <div className={"flex items-center text-gray-800 dark:text-gray-300"}>
                    <div className={"text-2xl"}>
                        <Icon/>
                    </div>
                    <h3 className={"mx-3 font-bold"}>{title}</h3>
                    {
                        badgeText && badgeText.length && <Badge>{badgeText}</Badge>
                    }
                </div>

                <p className={"dark:text-gray-400 text-gray-600 mt-2"}>{children}</p>
            </div>
        </Link>
    )
}
