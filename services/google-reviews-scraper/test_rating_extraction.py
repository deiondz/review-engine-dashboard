import unittest

from modules.models import RawReview


class RatingElement:
    text = "5/5"

    def get_attribute(self, name):
        return None


class HotelReviewCard:
    def get_attribute(self, name):
        return "review-id" if name == "data-review-id" else None

    def find_elements(self, by, selector):
        return [RatingElement()] if "fzvQIb" in selector else []

    def find_element(self, by, selector):
        return None


class RatingExtractionTest(unittest.TestCase):
    def test_extracts_hotel_rating_from_visible_x_out_of_five_text(self):
        self.assertEqual(RawReview.from_card(HotelReviewCard()).rating, 5.0)


if __name__ == "__main__":
    unittest.main()
