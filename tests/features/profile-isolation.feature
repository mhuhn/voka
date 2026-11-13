@voka
Feature: Profile-specific Voka data
  Scenario: Different profiles have separate subjects and lists
    Given I open the Voka app
    And I sign in as "alice@example.test" with password "correct-password"
    When I create a profile named "Student"
    And I return to Voka from the profile page
    Then no lists from the default profile are visible
    When I open the profile page
    And I switch to the profile named "Alice"
    Then the original lists are visible again
