import { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useFocusEffect,
  useRouter,
} from 'expo-router';

import {
  getPosts,
} from '../lib/postStorage';

import type {
  WorkoutPost,
} from '../lib/postStorage';

export default function HomeScreen() {
  const router = useRouter();

  const [posts, setPosts] =
    useState<WorkoutPost[]>([]);

  const loadPosts = async () => {
    const data = await getPosts();

    setPosts(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [])
  );

  const formatDuration = (
    seconds: number
  ) => {
    const minutes =
      Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes} MIN`;
    }

    const hours =
      Math.floor(minutes / 60);

    const remainingMinutes =
      minutes % 60;

    return `${hours}H ${remainingMinutes}M`;
  };

  const formatDate = (
    iso: string
  ) => {
    const date = new Date(iso);

    return date.toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
      }
    ).toUpperCase();
  };

  return (
    <SafeAreaView
      style={styles.container}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>
            LOADS
          </Text>

          <Text style={styles.tagline}>
            NO FLEX. JUST WORK.
          </Text>
        </View>

        <Pressable
          style={styles.quickWorkout}
          onPress={() =>
            router.push('/workout')
          }
        >
          <Text
            style={
              styles.quickWorkoutText
            }
          >
            +
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {posts.length === 0 ? (
          <View style={styles.empty}>
            <Text
              style={styles.emptyTitle}
            >
              NO WORK YET.
            </Text>

            <Text
              style={styles.emptyText}
            >
              Finish a workout and post
              it to start your feed.
            </Text>

            <Pressable
              style={
                styles.startButton
              }
              onPress={() =>
                router.push(
                  '/workout'
                )
              }
            >
              <Text
                style={
                  styles.startButtonText
                }
              >
                START WORKOUT
              </Text>
            </Pressable>
          </View>
        ) : (
          posts.map((post) => (
            <View
              key={post.id}
              style={styles.postCard}
            >
              <View
                style={
                  styles.postHeader
                }
              >
                <View
                  style={
                    styles.avatar
                  }
                >
                  <Text
                    style={
                      styles.avatarText
                    }
                  >
                    K
                  </Text>
                </View>

                <View
                  style={
                    styles.userArea
                  }
                >
                  <Text
                    style={
                      styles.username
                    }
                  >
                    KAZU
                  </Text>

                  <Text
                    style={
                      styles.postMeta
                    }
                  >
                    WORKOUT COMPLETE ·{' '}
                    {formatDate(
                      post.createdAt
                    )}
                  </Text>
                </View>
              </View>

              {post.photoUri ? (
                <Image
                  source={{
                    uri: post.photoUri,
                  }}
                  style={
                    styles.postPhoto
                  }
                />
              ) : (
                <View
                  style={
                    styles.noPhoto
                  }
                >
                  <Text
                    style={
                      styles.noPhotoText
                    }
                  >
                    WORKOUT COMPLETE
                  </Text>
                </View>
              )}

              <View
                style={
                  styles.postBody
                }
              >
                <View
                  style={
                    styles.statRow
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.statLabel
                      }
                    >
                      TIME
                    </Text>

                    <Text
                      style={
                        styles.statValue
                      }
                    >
                      {formatDuration(
                        post.durationSeconds
                      )}
                    </Text>
                  </View>

                  <View>
                    <Text
                      style={
                        styles.statLabel
                      }
                    >
                      SETS
                    </Text>

                    <Text
                      style={
                        styles.statValue
                      }
                    >
                      {post.totalSets}
                    </Text>
                  </View>

                  <View>
                    <Text
                      style={
                        styles.statLabel
                      }
                    >
                      VOLUME
                    </Text>

                    <Text
                      style={
                        styles.statValue
                      }
                    >
                      {post.totalVolume.toLocaleString()}
                      kg
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.divider
                  }
                />

                {post.exercises.map(
                  (exercise) => (
                    <View
                      key={
                        exercise.id
                      }
                      style={
                        styles.exerciseRow
                      }
                    >
                      <View>
                        <Text
                          style={
                            styles.exerciseName
                          }
                        >
                          {exercise.name}
                        </Text>

                        <Text
                          style={
                            styles.exerciseMeta
                          }
                        >
                          {
                            exercise.sets
                          }{' '}
                          SETS ·{' '}
                          {exercise.volume.toLocaleString()}
                          kg
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.bestSet
                        }
                      >
                        {
                          exercise.bestWeight
                        }
                        kg ×{' '}
                        {
                          exercise.bestReps
                        }
                      </Text>
                    </View>
                  )
                )}

                {post.caption ? (
                  <Text
                    style={
                      styles.caption
                    }
                  >
                    {post.caption}
                  </Text>
                ) : null}

                <View
                  style={
                    styles.reactionRow
                  }
                >
                  <Pressable
                    style={
                      styles.reactionButton
                    }
                  >
                    <Text
                      style={
                        styles.reactionText
                      }
                    >
                      🔥 NICE WORK
                    </Text>
                  </Pressable>

                  <Pressable
                    style={
                      styles.reactionButton
                    }
                  >
                    <Text
                      style={
                        styles.reactionText
                      }
                    >
                      STRONG
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#080808',
    },

    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      borderBottomWidth: 1,
      borderBottomColor:
        '#1B1B1B',
    },

    logo: {
      color: '#F5F5F2',
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: 2,
    },

    tagline: {
      marginTop: 2,
      color: '#555',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 2,
    },

    quickWorkout: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        '#D9FF43',
      alignItems: 'center',
      justifyContent: 'center',
    },

    quickWorkoutText: {
      color: '#080808',
      fontSize: 28,
      fontWeight: '500',
      marginTop: -2,
    },

    content: {
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 40,
    },

    empty: {
      marginTop: 80,
      alignItems: 'center',
      paddingHorizontal: 30,
    },

    emptyTitle: {
      color: '#F5F5F2',
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: 1,
    },

    emptyText: {
      marginTop: 10,
      color: '#666',
      textAlign: 'center',
      lineHeight: 20,
    },

    startButton: {
      marginTop: 28,
      width: '100%',
      backgroundColor:
        '#D9FF43',
      borderRadius: 8,
      paddingVertical: 17,
      alignItems: 'center',
    },

    startButtonText: {
      color: '#080808',
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    postCard: {
      backgroundColor:
        '#111111',
      borderWidth: 1,
      borderColor: '#202020',
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 18,
    },

    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },

    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        '#242424',
      alignItems: 'center',
      justifyContent: 'center',
    },

    avatarText: {
      color: '#D9FF43',
      fontWeight: '900',
    },

    userArea: {
      marginLeft: 10,
    },

    username: {
      color: '#F5F5F2',
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 1,
    },

    postMeta: {
      marginTop: 3,
      color: '#555',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1,
    },

    postPhoto: {
      width: '100%',
      aspectRatio: 4 / 5,
      backgroundColor:
        '#181818',
    },

    noPhoto: {
      width: '100%',
      aspectRatio: 4 / 3,
      backgroundColor:
        '#151515',
      alignItems: 'center',
      justifyContent: 'center',
    },

    noPhotoText: {
      color: '#444',
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 2,
    },

    postBody: {
      padding: 15,
    },

    statRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
    },

    statLabel: {
      color: '#555',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    statValue: {
      marginTop: 4,
      color: '#F5F5F2',
      fontSize: 16,
      fontWeight: '900',
    },

    divider: {
      height: 1,
      backgroundColor:
        '#242424',
      marginVertical: 15,
    },

    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 14,
    },

    exerciseName: {
      color: '#EDEDEA',
      fontSize: 13,
      fontWeight: '900',
    },

    exerciseMeta: {
      marginTop: 3,
      color: '#666',
      fontSize: 9,
      fontWeight: '700',
    },

    bestSet: {
      color: '#D9FF43',
      fontSize: 14,
      fontWeight: '900',
    },

    caption: {
      color: '#B5B5B5',
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
      marginBottom: 14,
    },

    reactionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },

    reactionButton: {
      backgroundColor:
        '#191919',
      borderWidth: 1,
      borderColor: '#282828',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },

    reactionText: {
      color: '#888',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
  });