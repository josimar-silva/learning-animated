# learning-animated

Animated learning sites, one per track, plus a home page at learning-animated.com. Kafka (an unofficial companion to the book _Kafka: The Definitive Guide_), Quarkus, and Java are the first tracks, and more can follow. Each lesson is a looping SVG animation, and that same SVG is the file that blog posts, talks, and pull requests embed. The sites are built with Astro and share one design system, one site kit, and one SVG toolchain.

## Sites

| Site    | Domain                        | Status                                                                                                  |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| Home    | learning-animated.com         | Not launched                                                                                            |
| Kafka   | kafka.learning-animated.com   | Live at [kafka-animated.josimar-silva.com](https://kafka-animated.josimar-silva.com/) until the cutover |
| Quarkus | quarkus.learning-animated.com | Not launched                                                                                            |
| Java    | java.learning-animated.com    | Not launched                                                                                            |

## Development

You need [Node.js](https://nodejs.org/) 24 or later and [just](https://just.systems/).

```sh
just install  # install dependencies
just test     # run every test suite
just check    # lint, check formatting, and type-check
```

Run `just` to list the other recipes.

## License

Released under the [MIT License](LICENSE).
