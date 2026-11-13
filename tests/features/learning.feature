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
    And the paused learning button keeps a short underline under its text
    When I skip the learning pause
    Then the next learning round is available immediately

  Scenario: Stopping early keeps grades and lets the user finish later
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    And I start learning the open list
    Then stopping early retains the last result and leaves other cards due

  @calendar-blocked
  Scenario: A list with minimum position one is paused until tomorrow at midnight
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    Then the list waits until tomorrow after a one-position delay

  @calendar-ready
  Scenario: After the calendar pause expires every card position advances by the minimum
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    When I start the next permitted calendar-spaced round
    Then the smallest active card position has been normalized to zero
