import {
  useCallback,
  useState,
} from 'react';

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
  const router =
    useRouter();

  const [
    posts,
    setPosts,
  ] =
    useState<WorkoutPost[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadPosts =
        async () => {
          try {
            setLoading(true);

            const data =
              await getPosts();

            setPosts(data);
          } catch (error) {
            console.error(
              'Failed to load posts:',
              error
            );
          } finally {
            setLoading(false);
          }
        };

      loadPosts();
    }, [])
  );

  const formatDate = (
    dateString: string
  ) => {
    const date =
      new Date(
        dateString
      );

    return date.toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
      }
    );
  };

  const formatTime = (
    totalSeconds: number
  ) => {
    const hours =
      Math.floor(
        totalSeconds /
          3600
      );

    const minutes =
      Math.floor(
        (
          totalSeconds %
          3600
        ) / 60
      );

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  };

  return (
    <SafeAreaView
      style={
        styles.container
      }
    >
      <View
        style={
          styles.header
        }
      >
        <View>
          <Text
            style={
              styles.logo
            }
          >
            LOADS
          </Text>

          <Text
            style={
              styles.tagline
            }
          >
            NO FLEX. JUST WORK.
          </Text>
        </View>

        <Pressable
          style={
            styles.workoutButton
          }
          onPress={() =>
            router.push(
              '/workout'
            )
          }
        >
          <Text
            style={
              styles.workoutButtonText
            }
          >
            +
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        {loading ? (
          <View
            style={
              styles.emptyState
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              LOADING...
            </Text>
          </View>
        ) : posts.length ===
          0 ? (
          <View
            style={
              styles.emptyState
            }
          >
            <Text
              style={
                styles.emptyLabel
              }
            >
              FEED
            </Text>

            <Text
              style={
                styles.emptyTitle
              }
            >
              NO WORK POSTED.
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Finish a workout and
              put the work on the
              board.
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
          posts.map(
            (post) => (
              <View
                key={
                  post.id
                }
                style={
                  styles.postCard
                }
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
                    style={{
                      flex: 1,
                    }}
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
                        styles.date
                      }
                    >
                      {formatDate(
                        post.createdAt
                      )}
                    </Text>
                  </View>

                  {(
                    post.prCount ??
                    0
                  ) > 0 && (
                    <View
                      style={
                        styles.postPRCount
                      }
                    >
                      <Text
                        style={
                          styles.postPRCountNumber
                        }
                      >
                        {
                          post.prCount
                        }
                      </Text>

                      <Text
                        style={
                          styles.postPRCountText
                        }
                      >
                        {post.prCount ===
                        1
                          ? 'PR'
                          : 'PRS'}
                      </Text>
                    </View>
                  )}
                </View>

                {post.photoUri ? (
                  <Image
                    source={{
                      uri:
                        post.photoUri,
                    }}
                    style={
                      styles.postImage
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
                      WORK LOG
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
                      styles.statsRow
                    }
                  >
                    <View
                      style={
                        styles.statItem
                      }
                    >
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
                        {formatTime(
                          post.durationSeconds
                        )}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.statDivider
                      }
                    />

                    <View
                      style={
                        styles.statItem
                      }
                    >
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
                        {
                          post.totalSets
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.statDivider
                      }
                    />

                    <View
                      style={
                        styles.statItem
                      }
                    >
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
                      styles.exerciseList
                    }
                  >
                    {post.exercises.map(
                      (
                        exercise
                      ) => (
                        <View
                          key={
                            exercise.id
                          }
                          style={
                            styles.exercise
                          }
                        >
                          <View
                            style={
                              styles.exerciseTop
                            }
                          >
                            <View>
                              <Text
                                style={
                                  styles.exerciseName
                                }
                              >
                                {
                                  exercise.name
                                }
                              </Text>

                              <Text
                                style={
                                  styles.exerciseFocus
                                }
                              >
                                {exercise.focus ??
                                  'VOLUME'}
                              </Text>
                            </View>

                            <Text
                              style={
                                styles.bestSet
                              }
                            >
                              {exercise.bestWeight >
                              0
                                ? `${exercise.bestWeight}kg × ${exercise.bestReps}`
                                : '—'}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.exerciseBottom
                            }
                          >
                            <Text
                              style={
                                styles.exerciseMeta
                              }
                            >
                              {
                                exercise.sets
                              }{' '}
                              SETS
                            </Text>

                            <Text
                              style={
                                styles.exerciseMeta
                              }
                            >
                              {exercise.volume.toLocaleString()}
                              kg
                            </Text>
                          </View>

                          {(
                            exercise.prTypes ??
                            []
                          ).length >
                            0 && (
                            <View
                              style={
                                styles.prRow
                              }
                            >
                              {exercise.prTypes.map(
                                (
                                  pr
                                ) => (
                                  <View
                                    key={
                                      pr
                                    }
                                    style={
                                      styles.prBadge
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.prBadgeText
                                      }
                                    >
                                      {
                                        pr
                                      }
                                    </Text>
                                  </View>
                                )
                              )}
                            </View>
                          )}
                        </View>
                      )
                    )}
                  </View>

                  {post.caption
                    .trim()
                    .length >
                    0 && (
                    <Text
                      style={
                        styles.caption
                      }
                    >
                      {
                        post.caption
                      }
                    </Text>
                  )}

                  <View
                    style={
                      styles.reactions
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
                        🔥
                      </Text>
                    </Pressable>

                    <Pressable
                      style={
                        styles.reactionButton
                      }
                    >
                      <Text
                        style={
                          styles.reactionLabel
                        }
                      >
                        STRONG
                      </Text>
                    </Pressable>

                    <Pressable
                      style={
                        styles.reactionButton
                      }
                    >
                      <Text
                        style={
                          styles.reactionLabel
                        }
                      >
                        NICE WORK
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#080808',
    },

    header: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
    },

    logo: {
      color:
        '#F5F5F2',
      fontSize: 28,
      fontWeight:
        '900',
      letterSpacing: 2,
    },

    tagline: {
      color: '#555',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing: 1.8,
      marginTop: 3,
    },

    workoutButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        '#D9FF43',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    workoutButtonText: {
      color:
        '#080808',
      fontSize: 26,
      lineHeight: 28,
      fontWeight:
        '800',
    },

    content: {
      padding: 14,
      paddingBottom: 50,
    },

    emptyState: {
      paddingTop: 120,
      alignItems:
        'center',
      paddingHorizontal: 25,
    },

    emptyLabel: {
      color:
        '#D9FF43',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing: 2,
    },

    emptyTitle: {
      color: '#777',
      fontSize: 20,
      fontWeight:
        '900',
      marginTop: 8,
    },

    emptyText: {
      color: '#555',
      textAlign:
        'center',
      lineHeight: 20,
      marginTop: 8,
    },

    startButton: {
      marginTop: 25,
      backgroundColor:
        '#D9FF43',
      borderRadius: 8,
      paddingHorizontal: 25,
      paddingVertical: 14,
    },

    startButtonText: {
      color:
        '#080808',
      fontWeight:
        '900',
    },

    postCard: {
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#242424',
      borderRadius: 13,
      overflow: 'hidden',
      marginBottom: 16,
    },

    postHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      padding: 14,
    },

    avatar: {
      width: 39,
      height: 39,
      borderRadius: 20,
      backgroundColor:
        '#202020',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    avatarText: {
      color:
        '#D9FF43',
      fontWeight:
        '900',
    },

    username: {
      color:
        '#F5F5F2',
      fontSize: 12,
      fontWeight:
        '900',
      letterSpacing: 0.8,
    },

    date: {
      color: '#555',
      fontSize: 9,
      marginTop: 2,
    },

    postPRCount: {
      alignItems:
        'center',
      justifyContent:
        'center',
      minWidth: 48,
      backgroundColor:
        '#D9FF43',
      borderRadius: 7,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },

    postPRCountNumber: {
      color:
        '#080808',
      fontSize: 16,
      fontWeight:
        '900',
    },

    postPRCountText: {
      color:
        '#080808',
      fontSize: 7,
      fontWeight:
        '900',
      letterSpacing: 1,
    },

    postImage: {
      width: '100%',
      aspectRatio: 4 / 5,
      backgroundColor:
        '#0D0D0D',
    },

    noPhoto: {
      height: 130,
      backgroundColor:
        '#0C0C0C',
      alignItems:
        'center',
      justifyContent:
        'center',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor:
        '#1D1D1D',
    },

    noPhotoText: {
      color: '#282828',
      fontSize: 24,
      fontWeight:
        '900',
      letterSpacing: 3,
    },

    postBody: {
      padding: 14,
    },

    statsRow: {
      flexDirection:
        'row',
      backgroundColor:
        '#0C0C0C',
      borderRadius: 8,
      paddingVertical: 12,
    },

    statItem: {
      flex: 1,
      alignItems:
        'center',
    },

    statDivider: {
      width: 1,
      backgroundColor:
        '#222',
    },

    statLabel: {
      color: '#555',
      fontSize: 7,
      fontWeight:
        '900',
      letterSpacing: 1,
    },

    statValue: {
      color: '#CCC',
      fontSize: 12,
      fontWeight:
        '900',
      marginTop: 4,
    },

    exerciseList: {
      marginTop: 12,
    },

    exercise: {
      borderBottomWidth: 1,
      borderBottomColor:
        '#1C1C1C',
      paddingVertical: 11,
    },

    exerciseTop: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
    },

    exerciseName: {
      color:
        '#F5F5F2',
      fontSize: 13,
      fontWeight:
        '900',
    },

    exerciseFocus: {
      color: '#4D4D4D',
      fontSize: 7,
      fontWeight:
        '900',
      marginTop: 3,
      letterSpacing: 1,
    },

    bestSet: {
      color:
        '#D9FF43',
      fontSize: 12,
      fontWeight:
        '900',
    },

    exerciseBottom: {
      flexDirection:
        'row',
      gap: 12,
      marginTop: 6,
    },

    exerciseMeta: {
      color: '#555',
      fontSize: 8,
      fontWeight:
        '800',
    },

    prRow: {
      flexDirection:
        'row',
      flexWrap: 'wrap',
      gap: 5,
      marginTop: 8,
    },

    prBadge: {
      backgroundColor:
        '#D9FF43',
      borderRadius: 4,
      paddingHorizontal: 7,
      paddingVertical: 4,
    },

    prBadgeText: {
      color:
        '#080808',
      fontSize: 7,
      fontWeight:
        '900',
      letterSpacing: 0.5,
    },

    caption: {
      color: '#BDBDBD',
      fontSize: 12,
      lineHeight: 19,
      marginTop: 14,
    },

    reactions: {
      flexDirection:
        'row',
      gap: 7,
      marginTop: 15,
    },

    reactionButton: {
      backgroundColor:
        '#181818',
      borderWidth: 1,
      borderColor:
        '#262626',
      borderRadius: 7,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },

    reactionText: {
      fontSize: 13,
    },

    reactionLabel: {
      color: '#777',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing: 0.7,
    },
  });