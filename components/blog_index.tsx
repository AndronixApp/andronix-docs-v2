import Link from "next/link";

interface BlogPost {
    title: string;
    slug: string;
    description?: string;
    date?: string;
}

const blogPosts: BlogPost[] = [
    {
        title: "Calling for Andronix Maintainers",
        slug: "andronix-maintainers",
        description: "We are looking for maintainers for Andronix. If you are interested, please read this blog.",
        date: "December 26, 2023"
    },
    {
        title: "Andronix 7.0 - Refresh",
        slug: "v7-0",
        description: "Long time no-see, and here we are again. Andronix is getting updated to version 7.0.",
        date: "January 17, 2023"
    },
    {
        title: "Andronix 6.0 - A new beginning...",
        slug: "v6-0",
        description: "Andronix 6.0 is here. A new beginning for Andronix. Read more about the changes in this blog.",
        date: "August 11, 2021"
    },
    {
        title: "Andronix, Termux and F-Droid",
        slug: "andronix-termux-and-f-droid",
        description: "Information about migrating Termux from Google Play Store to F-Droid after the shut-down of Bintray, a package hosting service from Jfrog.",
        date: "July 14, 2021"
    }
];

export default function BlogIndex({ more = "Read more" }: { more?: string }) {
    return (
        <>
            {blogPosts.map((post) => (
                <div key={post.slug} className="mb-10">
                    <h3>
                        <Link
                            href={`/blog/${post.slug}`}
                            style={{ color: "inherit", textDecoration: "none" }}
                            className="block font-semibold mt-8 text-2xl "
                        >
                            {post.title}
                        </Link>
                    </h3>
                    <p className="opacity-80 mt-6 leading-7">
                        {post.description}{" "}
                        <span className="inline-block">
                            <Link
                                href={`/blog/${post.slug}`}
                                className="text-primary underline underline-offset-2 decoration-from-font"
                            >
                                {more + " →"}
                            </Link>
                        </span>
                    </p>
                    {post.date && (
                        <p className="opacity-50 text-sm mt-6 leading-7">
                            {post.date}
                        </p>
                    )}
                </div>
            ))}
        </>
    );
}
