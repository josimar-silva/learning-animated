export const AUTHOR = { name: 'Josimar Silva', url: 'https://josimar-silva.com' } as const;
export const KAIZEN_URL = 'https://kaizen.josimar-silva.com';
export const HOME_URL = 'https://learning-animated.com/';

export type FamilyMember = {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly url: string;
  readonly listed: boolean;
};

// Kafka keeps its old host until the cutover. Quarkus and Java join the list at launch.
export const FAMILY: readonly FamilyMember[] = [
  {
    id: 'kafka',
    name: 'Kafka Animated',
    tagline: 'A visual companion that animates Kafka internals chapter by chapter.',
    url: 'https://kafka-animated.josimar-silva.com/',
    listed: true,
  },
  {
    id: 'quarkus',
    name: 'Quarkus Animated',
    tagline: 'Quarkus internals, animated one idea at a time.',
    url: 'https://quarkus.learning-animated.com/',
    listed: false,
  },
  {
    id: 'java',
    name: 'Java Animated',
    tagline: 'Java and the JVM, animated one idea at a time.',
    url: 'https://java.learning-animated.com/',
    listed: false,
  },
];

export const listedFamily = (): FamilyMember[] => FAMILY.filter((member) => member.listed);
