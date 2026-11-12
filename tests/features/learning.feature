@voka @learning
Feature: Learning cards in Voka
  Learning is a focused session for cards at position zero with fewer than four
  successful runs. Every grade is persisted, even when learning is stopped early.

  Scenario: Turn over cards, fix a mistake and grade the entire round
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    And I start learning the open list
    Then learning hides the list workspace and shows a question only
    When I reveal the learning card
    Then the answer flips into view with the matching label
    When I correct and star the revealed card
    Then all three answers save the rules and finish the list
    And the two-hour pause survives a page reload

  Scenario: Stopping early keeps grades and lets the user finish later
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    And I start learning the open list
    Then stopping early retains the last result and leaves other cards due
