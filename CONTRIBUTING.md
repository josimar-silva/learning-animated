## Contributing

Hey there!!! We are happy that you would like to contribute to make this project great!

The section below has everything you need to start contributing.

All contributions to this project are released under its licenses: lessons and artwork under [CC BY-NC 4.0](LICENSE-CC-BY-NC), and everything else under the [PolyForm Noncommercial License 1.0.0](LICENSE).

This project is released with a Contributor [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

Happy coding :-).

### Submitting a pull request

These are the general steps to open a pull request with your contribution:

1. [Fork](https://github.com/josimar-silva/learning-animated/fork) and clone the repository;

```sh
git clone git@github.com:josimar-silva/learning-animated && cd learning-animated
```

2. Install dependencies. Make sure you have [Node.js](https://nodejs.org/) `24+` and [just](https://just.systems/) installed;

```sh
just ci
```

3. Create a new branch: `git checkout -b your-branch-name`;
4. Follow test-driven development: write the failing test first, then the change that makes it pass;
5. Keep the checks and tests green (`just format` applies lint fixes and formatting);

```sh
just check
just test
```

6. Commit your changes following the [conventional commit specification](https://www.conventionalcommits.org/). Use atomic commits and no em dashes or en dashes;
7. Push to your fork and [submit a pull request](https://github.com/josimar-silva/learning-animated/compare);
8. Enjoy a cup of coffee while we review your pull request.

A few things to keep in mind while preparing your pull request:

- Write tests for your changes;
- Keep your changes focused. If there are independent changes, consider separate pull requests;
- Write good [commit messages](https://github.blog/2022-06-30-write-better-commits-build-better-projects/).

With that in mind, the chances of your pull request being accepted will be quite high.

---

## Resources

- [How to contribute to Open Source?](https://opensource.guide/how-to-contribute/);
- [Write better commits, build better projects](https://github.blog/2022-06-30-write-better-commits-build-better-projects/);
- [About Pull Requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests);
