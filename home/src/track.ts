import { defineTrack } from '@learning-animated/site-kit/schemas';

export default defineTrack({
  id: 'home',
  kind: 'home',
  launched: false,
  site: {
    url: 'https://learning-animated.com/',
    name: 'Learning Animated',
    shortName: 'Learning Animated',
    tagline: 'For all the visual learners out there.',
    repoUrl: 'https://github.com/josimar-silva/learning-animated',
  },
});
