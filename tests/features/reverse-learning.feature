@voka @reverse
Feature: Independent reversed-direction learning
  A list can ask the same card both normally and in reverse, keeping separate
  points and positions. The forward question is always asked first.

  Scenario: At 25 percent, normal and reversed cards are queued and graded separately
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    Then the list detail shows separate reverse learning points
    When I start learning the open list
    Then the normal orientation is first
    When I reveal the learning card
    Then the revealed answer has a clear light-blue background
    When I grade the normal orientation as known
    Then the reverse orientation of the same card follows
    When I reveal the learning card
    And I grade the reverse orientation as known
    Then the two independent score tracks are updated

  Scenario: Creating a new list inherits the last reverse percentage in that subject
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    Then the new list inherits its subject's reverse percentage
