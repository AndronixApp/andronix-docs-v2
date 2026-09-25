export default function Authors({ date, children, by = "by" }: { date: string; children: React.ReactNode; by?: string }) {
    return (
        <div className="mt-4 mb-16 text-fd-muted-foreground text-sm">
            {date} {by} {children}
        </div>
    );
}

export function Author({ name, link }: { name: string; link?: string }) {
    return (
        <span className="mx-1 after:content-[','] last:after:content-['']">
            {link ? (
                <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-current underline [text-underline-position:from-font] decoration-from-font"
                >
                    {name}
                </a>
            ) : (
                <span className="font-medium text-fd-foreground">{name}</span>
            )}
        </span>
    );
}
